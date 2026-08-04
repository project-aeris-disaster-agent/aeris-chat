export const dynamic = 'force-dynamic'
// Without this the platform default (well under our own 45s LLM budget) kills
// the function first, so the client receives a non-JSON platform error page
// instead of our handled timeout. Covers prefetch + LLM + persistence.
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTH_DISABLED } from '@/lib/config'
import { runAgentLoop } from '@/lib/chat/agent-loop'
import {
  formatLocationContextBlock,
  makePhDefaultLocation,
  parseChatLocationPayload,
  resolveChatLocation,
} from '@/lib/chat/location-payload'
import {
  callNvidiaChatCompletion,
  getDefaultLlmTimeoutMs,
  getNvidiaConfig,
  type AgentMessage,
  type ChatMessage as NvidiaChatMessage,
} from '@/lib/nvidia-llm'
import { getCitizenSystemPrompt } from '@/lib/character/aeris-character'
import { getClientIP } from '@/lib/utils/anonymous-session'
import { detectWeatherIntentWithHistory } from '@/lib/weather/intent'
import { detectPlaceMentionWithHistory } from '@/lib/weather/place-mention'
import { detectIncidentIntent } from '@/lib/incidents/intent'
import { detectEmergencyInfoIntentWithHistory } from '@/lib/emergency/intent'
import { detectHazardIntent } from '@/lib/hazards/intent'
import { fetchHazardNews, formatHazardNewsBlock } from '@/lib/news/hazard-context'
import {
  formatHotlineContextBlock,
  getHotlineDirectory,
} from '@/lib/emergency/hotlines'
import { findNearbyEvacCenters } from '@/lib/emergency/evac-centers'
import {
  buildWeatherLiveContext,
  formatWeatherLiveContextBlock,
  type ForecastPlaceOverride,
} from '@/lib/weather/build-context'
import { runWeatherTool, WEATHER_AGENT_TOOLS } from '@/lib/weather/agent-tools'
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from '@/lib/security/rate-limit'
import { resolveAnonId } from '@/lib/security/anon-identity'
import { checkChatRateLimit, rateLimitHeaders } from '@/lib/guardrails/rate-limit'
import { validateChatMessages } from '@/lib/guardrails/validate'
import { scanForInjection, INJECTION_REINFORCEMENT } from '@/lib/guardrails/injection'
import { sanitizeSignalClaims, stripInternalIdentifiers } from '@/lib/guardrails/signal-claims'
import {
  moderateInput,
  moderateOutput,
  inputRefusalMessage,
  outputFallbackMessage,
} from '@/lib/guardrails/moderation'

/**
 * True when the model returned nothing but its required closing disclaimer
 * (and no substantive answer). Strips the disclaimer sentences and checks
 * whether anything meaningful is left.
 */
function isDisclaimerOnly(message: string): boolean {
  const stripped = message
    .replace(/not an official[^.\n]*\.?/gi, '')
    .replace(/follow pagasa[^.\n]*\.?/gi, '')
    .replace(/follow phivolcs[^.\n]*\.?/gi, '')
    .replace(/[\s*_#>-]/g, '')
  return stripped.length < 15
}

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

    let serviceClient
    try {
      serviceClient = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Supabase service credentials are not configured' },
        { status: 500 },
      )
    }

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

    const rateLimit = await checkChatRateLimit(request, {
      userId: user?.id ?? null,
      anonymousId: anonymousId ?? null,
    })
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down and try again shortly.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      )
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

    const validation = validateChatMessages(messages)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status })
    }

    // SECURITY: never honor client-supplied `system` messages. They are a
    // prompt-injection vector that could replace the AERIS safety persona. We
    // keep only user/assistant turns; the server injects the system prompt.
    const sanitizedMessages: NvidiaChatMessage[] = validation.messages.filter(
      (m) => m.role !== 'system',
    )

    if (sanitizedMessages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid messages: at least one non-empty message is required.' },
        { status: 400 },
      )
    }

    const latestUserMessage =
      [...sanitizedMessages].reverse().find((m) => m.role === 'user')?.content ?? ''

    // Content moderation on the latest user input, before any model call.
    const inputVerdict = await moderateInput(latestUserMessage)
    if (!inputVerdict.allowed) {
      const refusal = inputRefusalMessage()
      console.warn(
        `[guardrails] input blocked (${inputVerdict.category}) for session ${sessionId}`,
      )
      await persistUserAndAssistant(refusal)
      return NextResponse.json({
        message: refusal,
        provider: 'nvidia',
        model: nvidiaConfig.model,
      })
    }

    const injection = scanForInjection(latestUserMessage)
    if (injection.detected) {
      console.warn(
        `[guardrails] possible prompt injection in session ${sessionId}:`,
        injection.matched,
      )
    }

    // Weather intent with follow-up support: a short reply like "and in
    // Baguio?" inherits the intent of a recent weather question.
    const allUserMessages = sanitizedMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
    const priorUserMessages = allUserMessages.slice(0, -1)
    const weatherIntent = detectWeatherIntentWithHistory(
      latestUserMessage,
      priorUserMessages,
    )

    const clientIp = getClientIP(request) ?? 'unknown'
    const clientLocation = parseChatLocationPayload(rawLocation)
    const resolvedLocation = await resolveChatLocation(clientLocation, clientIp)

    const systemPrompt = process.env.LLM_SYSTEM_PROMPT?.trim() || getCitizenSystemPrompt()

    const contextBlocks: string[] = []
    if (resolvedLocation) {
      contextBlocks.push(formatLocationContextBlock(resolvedLocation))
    }

    // Typhoon/PAR status is a national-scope question — GDACS returns the
    // same cyclone list regardless of the asker's exact position. Fall back
    // to a synthetic PH-wide location instead of requiring a location fix, so
    // "is there a storm in PAR?" still gets the fast, reliable prefetch path
    // (one LLM call) instead of the slower/flakier tool-loop fallback below.
    // Forecast/"both" intents still require a real location: rainfall is
    // location-specific and answering from a wrong default would mislead.
    const weatherContextLocation =
      resolvedLocation ??
      (weatherIntent.kind === 'typhoon' ? makePhDefaultLocation() : null)

    // Emergency reference: verified hotlines whenever the user asks for numbers
    // OR reports an active incident (SOS answers must ground their phone
    // numbers); nearby evacuation centers when asked to evacuate. History-aware
    // so a short follow-up ("opo", "which is nearest?") keeps the hotline/evac
    // context of the turn it is answering.
    const emergencyInfo = detectEmergencyInfoIntentWithHistory(
      latestUserMessage,
      priorUserMessages,
    )
    const incidentIntent = detectIncidentIntent(latestUserMessage)

    // Hazard news is prefetched for two distinct reasons:
    //
    // 1. Earthquakes, volcanoes and landslides have no dedicated upstream feed,
    //    so Philippine disaster reporting is our only live source for them.
    //
    // 2. GDACS MISSES WEAKER PAR SYSTEMS. Verified 2026-08-04: PAGASA-named
    //    Tropical Depression "Luis" was causing landslides and class
    //    suspensions across Luzon while the GDACS TC feed listed zero
    //    Philippine storms. Tropical depressions cause much of the deadly
    //    flooding here, so a typhoon answer grounded on GDACS alone can be a
    //    false negative. Pulling news in alongside it catches PAGASA-named
    //    systems that GDACS does not carry.
    const hazardIntent = detectHazardIntent(latestUserMessage)
    const typhoonQuestion =
      weatherIntent.match && (weatherIntent.kind === 'typhoon' || weatherIntent.kind === 'both')

    const wantsWeather = Boolean(
      weatherIntent.match && weatherIntent.kind && weatherContextLocation,
    )
    const wantsEvac = Boolean(emergencyInfo.evac && resolvedLocation)
    const wantsHazardNews = hazardIntent.match || typhoonQuestion

    // Run every upstream prefetch CONCURRENTLY. These used to await in series,
    // so a weather+evac+news turn paid GDACS (~5s) + Overpass + RSS (~2.5s)
    // back to back — all of it before the LLM budget even starts. Wall time is
    // now the slowest single fetch instead of their sum.
    const [liveContext, evac, hazardNews] = await Promise.all([
      wantsWeather
        ? (() => {
            // Widen the forecast window when the user asks about "this week".
            const wantsWeek = /\b(week|linggo|days)\b/i.test(latestUserMessage)
            const days = wantsWeek ? 7 : undefined

            // If the user named a known PH city ("will it rain in Cebu?"), fetch
            // the forecast for that place instead of their own coordinates.
            // Short follow-ups ("yes") inherit the place from a recent turn.
            const placeMention = detectPlaceMentionWithHistory(
              latestUserMessage,
              priorUserMessages,
            )
            const placeOverride: ForecastPlaceOverride | null = placeMention
              ? {
                  label: `${placeMention.name}, ${placeMention.region}`,
                  lat: placeMention.lat,
                  lng: placeMention.lng,
                }
              : null

            return buildWeatherLiveContext(
              weatherContextLocation as NonNullable<typeof weatherContextLocation>,
              weatherIntent.kind as NonNullable<typeof weatherIntent.kind>,
              days,
              placeOverride,
            )
          })()
        : Promise.resolve(null),
      wantsEvac
        ? findNearbyEvacCenters(
            resolvedLocation!.position[1],
            resolvedLocation!.position[0],
          )
        : Promise.resolve(null),
      wantsHazardNews ? fetchHazardNews() : Promise.resolve(null),
    ])

    let hasUsableWeatherData = false
    if (liveContext) {
      hasUsableWeatherData = Boolean(
        liveContext.forecast?.available || liveContext.cyclones?.available,
      )
      contextBlocks.push(formatWeatherLiveContextBlock(liveContext))
    }

    if (emergencyInfo.match || incidentIntent.match) {
      const [lng, lat] = resolvedLocation?.position ?? [undefined, undefined]
      contextBlocks.push(formatHotlineContextBlock(getHotlineDirectory(lat, lng)))
    }

    if (evac) {
      contextBlocks.push(`EVAC_CENTERS (JSON):\n${JSON.stringify(evac, null, 2)}`)
    }

    if (hazardNews) {
      contextBlocks.push(formatHazardNewsBlock(hazardNews))
    }

    const systemMessages: NvidiaChatMessage[] = []
    if (systemPrompt) {
      systemMessages.push({ role: 'system', content: systemPrompt })
    }
    // Re-assert guardrails when an injection attempt was detected.
    if (injection.detected) {
      systemMessages.push({ role: 'system', content: INJECTION_REINFORCEMENT })
    }
    for (const block of contextBlocks) {
      systemMessages.push({ role: 'system', content: block })
    }

    const finalMessages: AgentMessage[] = [...systemMessages, ...sanitizedMessages]

    // Shared with lib/nvidia-llm so the deadline that fires is the one we report.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), getDefaultLlmTimeoutMs())

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

      // The persona requires closing with the safety disclaimer, and the model
      // occasionally emits ONLY that — a technically-compliant but empty answer
      // (observed ~8% of turns). Retry once without the disclaimer requirement
      // rather than shipping a reply with no content in it.
      if (isDisclaimerOnly(aiMessage)) {
        console.warn(`[chat] disclaimer-only response for session ${sessionId}; retrying`)
        aiMessage = await callNvidiaChatCompletion(
          [
            ...(finalMessages as NvidiaChatMessage[]),
            {
              role: 'system',
              content:
                'Your previous reply contained only the closing disclaimer and no actual answer. Answer the question directly and substantively first. Do not reply with the disclaimer alone.',
            },
          ],
          { signal: controller.signal },
        )
      }

      clearTimeout(timeoutId)

      // SAFETY: we have no per-area TCWS feed, so any wind-signal level the
      // model attributes to the user's own location is fabricated. Rewrite it
      // before the user can act on it. Also scrub internal context identifiers
      // that occasionally leak into the reply.
      const signalCheck = sanitizeSignalClaims(
        aiMessage,
        contextBlocks,
        resolvedLocation?.label ?? null,
      )
      if (signalCheck.modified) {
        console.warn(
          `[guardrails] ungrounded signal claim rewritten for session ${sessionId}:`,
          signalCheck.removed,
        )
        aiMessage = signalCheck.text
      }
      const identifierCheck = stripInternalIdentifiers(aiMessage)
      if (identifierCheck.modified) {
        console.warn(`[guardrails] internal identifier leaked for session ${sessionId}`)
        aiMessage = identifierCheck.text
      }

      // Moderate model output before returning it to the user.
      const outputVerdict = await moderateOutput(aiMessage)
      if (!outputVerdict.allowed) {
        console.warn(
          `[guardrails] output blocked (${outputVerdict.category}) for session ${sessionId}`,
        )
        aiMessage = outputFallbackMessage()
      }

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
