export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'
import { runAgentLoop } from '@/lib/chat/agent-loop'
import {
  formatLocationContextBlock,
  parseChatLocationPayload,
  resolveChatLocation,
} from '@/lib/chat/location-payload'
import {
  callNvidiaChatCompletion,
  getNvidiaConfig,
  type AgentMessage,
  type ChatMessage as NvidiaChatMessage,
} from '@/lib/nvidia-llm'
import { getCitizenSystemPrompt } from '@/lib/character/aeris-character'
import { getClientIP } from '@/lib/utils/anonymous-session'
import { detectWeatherIntent } from '@/lib/weather/intent'
import {
  buildWeatherLiveContext,
  formatWeatherLiveContextBlock,
} from '@/lib/weather/build-context'
import { runWeatherTool, WEATHER_AGENT_TOOLS } from '@/lib/weather/agent-tools'
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from '@/lib/security/rate-limit'
import { resolveAnonId } from '@/lib/security/anon-identity'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null

    if (!AUTH_DISABLED) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    let body:
      | {
          sessionId?: string
          messages?: Array<{ role?: string; content?: string }>
          anonymousId?: string
          location?: unknown
        }
      | undefined
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Expected application/json payload.' },
        { status: 400 }
      )
    }

    const { sessionId, messages, anonymousId: bodyAnonId, location: rawLocation } = body ?? {}

    // Server-authoritative identity from the signed cookie; the body value is
    // only a first-use hint and is never trusted for ownership.
    const anonymousId = await resolveAnonId(bodyAnonId)

    // Generous ceiling: normal conversation (including emergency/SOS chat) never
    // approaches this, but it caps automated credit-burn loops against the LLM.
    const chatLimit = checkRateLimit(clientRateKey('chat', request, anonymousId), {
      windowMs: 60_000,
      max: 20,
    })
    if (!chatLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { 'retry-after': String(rateLimitRetryAfterSeconds(chatLimit)) },
        },
      )
    }

    if (
      !sessionId ||
      !messages ||
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid request. sessionId and a non-empty messages array are required.',
        },
        { status: 400 }
      )
    }

    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: session, error: sessionError } = await serviceClient
      .from('chat_sessions')
      .select('user_id, anonymous_id, metadata')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (user && session.user_id === user.id) {
      // ok
    } else if (!user && session.anonymous_id && anonymousId === session.anonymous_id) {
      // ok
    } else if (AUTH_DISABLED && session.anonymous_id && anonymousId === session.anonymous_id) {
      // ok
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const persistUserAndAssistant = async (aiMessage: string) => {
      const userMessageContent = messages[messages.length - 1]?.content
      if (userMessageContent) {
        try {
          await serviceClient.from('messages').insert({
            session_id: sessionId,
            role: 'user',
            content: userMessageContent,
          })
        } catch {
          console.log('User message may already exist')
        }
      }

      const { error: assistantError } = await serviceClient
        .from('messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content: aiMessage,
        })
        .select()
        .single()

      if (assistantError) {
        console.error('Error inserting assistant message:', assistantError)
      }
    }

    const nvidiaConfig = getNvidiaConfig()
    if (!nvidiaConfig) {
      return NextResponse.json(
        {
          error:
            'NVIDIA_API_KEY is not configured on AERIS CHAT. See docs/AGENT_CONTRACT.md.',
        },
        { status: 503 }
      )
    }

    const sanitizedMessages: NvidiaChatMessage[] = messages
      .filter(
        (m): m is { role: string; content: string } =>
          typeof m?.role === 'string' && typeof m?.content === 'string',
      )
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content.trim(),
      }))
      .filter((m) => m.content.length > 0)
      .slice(-20)

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid messages: at least one non-empty message is required.' },
        { status: 400 },
      )
    }

    const latestUserMessage =
      [...sanitizedMessages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const weatherIntent = detectWeatherIntent(latestUserMessage)

    const clientIp = getClientIP(request) ?? 'unknown'
    const clientLocation = parseChatLocationPayload(rawLocation)
    const resolvedLocation = await resolveChatLocation(clientLocation, clientIp)

    const systemPrompt = process.env.LLM_SYSTEM_PROMPT?.trim() || getCitizenSystemPrompt()
    const hasSystem = sanitizedMessages.some((m) => m.role === 'system')

    const contextBlocks: string[] = []
    if (resolvedLocation) {
      contextBlocks.push(formatLocationContextBlock(resolvedLocation))
    }

    let hasUsableWeatherData = false
    if (weatherIntent.match && weatherIntent.kind && resolvedLocation) {
      // Widen the forecast window when the user asks about "this week".
      const wantsWeek = /\b(week|linggo|days)\b/i.test(latestUserMessage)
      const days = wantsWeek ? 7 : undefined
      const liveContext = await buildWeatherLiveContext(
        resolvedLocation,
        weatherIntent.kind,
        days,
      )
      hasUsableWeatherData = Boolean(
        liveContext.forecast?.available || liveContext.cyclones?.available,
      )
      contextBlocks.push(formatWeatherLiveContextBlock(liveContext))
    }

    const systemMessages: NvidiaChatMessage[] = []
    if (systemPrompt && !hasSystem) {
      systemMessages.push({ role: 'system', content: systemPrompt })
    }
    for (const block of contextBlocks) {
      systemMessages.push({ role: 'system', content: block })
    }

    const conversationMessages = hasSystem
      ? sanitizedMessages
      : sanitizedMessages.filter((m) => m.role !== 'system')

    const finalMessages: AgentMessage[] = [...systemMessages, ...conversationMessages]

    const controller = new AbortController()
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? '45000')
    const timeoutId = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000,
    )

    try {
      let aiMessage: string

      if (weatherIntent.match && hasUsableWeatherData) {
        // Prefetch path: LIVE_CONTEXT already holds the data the model needs,
        // so answer directly without tools. This is the reliable common path
        // and avoids weaker models leaking tool-call JSON as text.
        aiMessage = await callNvidiaChatCompletion(finalMessages as NvidiaChatMessage[], {
          signal: controller.signal,
        })
      } else if (weatherIntent.match) {
        // Prefetch could not gather usable data (e.g. no location). Let the
        // model use tools to try fetching what it needs.
        aiMessage = await runAgentLoop(finalMessages, {
          signal: controller.signal,
          tools: WEATHER_AGENT_TOOLS,
          runTool: (name, args) =>
            runWeatherTool(name, args, { userLocation: resolvedLocation }),
        })
      } else {
        aiMessage = await callNvidiaChatCompletion(finalMessages as NvidiaChatMessage[], {
          signal: controller.signal,
        })
      }

      clearTimeout(timeoutId)

      await persistUserAndAssistant(aiMessage)
      return NextResponse.json({
        message: aiMessage,
        provider: 'nvidia',
        model: nvidiaConfig.model,
      })
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const error = err as { name?: string; message?: string }
      if (error?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout. NVIDIA LLM took too long to respond.' },
          { status: 504 },
        )
      }
      console.error('NVIDIA LLM error:', error?.message ?? err)
      return NextResponse.json(
        { error: error?.message || 'Failed to get AI response from NVIDIA.' },
        { status: 502 },
      )
    }
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
