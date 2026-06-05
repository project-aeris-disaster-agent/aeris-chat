export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'
import {
  callNvidiaChatCompletion,
  getNvidiaConfig,
  type ChatMessage as NvidiaChatMessage,
} from '@/lib/nvidia-llm'
import { getCitizenSystemPrompt } from '@/lib/character/aeris-character'

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

    const { sessionId, messages, anonymousId } = body ?? {}

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

    // The compiled AERIS character card is the default persona. LLM_SYSTEM_PROMPT
    // (if set) overrides it, and an existing in-conversation system message wins.
    const systemPrompt = process.env.LLM_SYSTEM_PROMPT?.trim() || getCitizenSystemPrompt()
    const hasSystem = sanitizedMessages.some((m) => m.role === 'system')
    const finalMessages: NvidiaChatMessage[] =
      systemPrompt && !hasSystem
        ? [{ role: 'system', content: systemPrompt }, ...sanitizedMessages]
        : sanitizedMessages

    const controller = new AbortController()
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? '45000')
    const timeoutId = setTimeout(
      () => controller.abort(),
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 45000,
    )

    try {
      const aiMessage = await callNvidiaChatCompletion(finalMessages, {
        signal: controller.signal,
      })
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
