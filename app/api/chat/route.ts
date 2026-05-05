export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'
import {
  callLlmHttpChat,
  getLlmHttpApiKey,
  getLlmHttpBaseUrl,
  LlmHttpError,
} from '@/lib/llm-http'

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

    const httpBase = getLlmHttpBaseUrl()
    if (httpBase) {
      const userMessageContent = messages[messages.length - 1]?.content
      if (!userMessageContent || typeof userMessageContent !== 'string') {
        return NextResponse.json(
          { error: 'Invalid messages: expected last message with text content.' },
          { status: 400 }
        )
      }

      let storedConvId: string | undefined
      const meta = session.metadata
      if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
        const id = (meta as Record<string, unknown>).llm_conversation_id
        if (typeof id === 'string' && id.trim()) storedConvId = id.trim()
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const chatData = await callLlmHttpChat({
          baseUrl: httpBase,
          apiKey: getLlmHttpApiKey(),
          message: userMessageContent,
          conversationId: storedConvId,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        const prevMeta =
          session.metadata &&
          typeof session.metadata === 'object' &&
          !Array.isArray(session.metadata)
            ? { ...(session.metadata as Record<string, unknown>) }
            : {}
        prevMeta.llm_conversation_id = chatData.conversationId

        const { error: metaErr } = await serviceClient
          .from('chat_sessions')
          .update({ metadata: prevMeta })
          .eq('id', sessionId)

        if (metaErr) {
          console.error('Failed to update session LLM metadata:', metaErr)
        }

        const aiMessage = chatData.message
        await persistUserAndAssistant(aiMessage)
        return NextResponse.json({ message: aiMessage })
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId)
        const err = fetchError as { name?: string; message?: string }
        if (fetchError instanceof LlmHttpError) {
          return NextResponse.json(
            {
              error:
                fetchError.status === 503
                  ? 'LLM provider is unavailable (503). Check backend process and tunnel target port.'
                  : fetchError.message,
            },
            { status: fetchError.status }
          )
        }
        if (err.name === 'AbortError') {
          return NextResponse.json(
            {
              error:
                'Request timeout. The LLM service took too long to respond. Please try again.',
            },
            { status: 504 }
          )
        }
        if (
          err.message?.includes('fetch failed') ||
          err.message?.includes('CORS')
        ) {
          return NextResponse.json(
            {
              error:
                `Unable to reach the LLM service at ${httpBase}. Check that backend is running and reachable from this app process.`,
            },
            { status: 503 }
          )
        }
        return NextResponse.json(
          { error: err.message || 'Failed to get AI response' },
          { status: 502 }
        )
      }
    }

    // Legacy: Flask-style backend with full messages array
    const backendBaseUrl =
      process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
    const backendUrl = `${backendBaseUrl}/api/llm/chat`
    const apiKey = process.env.LLM_API_KEY

    if (!backendBaseUrl) {
      return NextResponse.json(
        {
          error:
            'No LLM configured. Set NEXT_PUBLIC_LLM_API_URL (or LLM_HTTP_API_BASE_URL) for the HTTP LLM API, or NEXT_PUBLIC_BACKEND_API_URL + LLM_API_KEY for the legacy backend.',
        },
        { status: 500 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'LLM_API_KEY is not configured (legacy Flask backend), or set NEXT_PUBLIC_LLM_API_URL for the HTTP LLM API.',
        },
        { status: 500 }
      )
    }

    const requestBody = {
      messages: messages
        .filter(
          (m) => typeof m?.role === 'string' && typeof m?.content === 'string'
        )
        .map((m) => ({
          role: m.role as string,
          content: m.content as string,
        })),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!backendResponse.ok) {
        let errorMessage = 'Failed to get AI response from backend'

        try {
          const errorData = await backendResponse.json()
          errorMessage =
            errorData.message || errorData.error || errorMessage
        } catch {
          errorMessage = backendResponse.statusText || errorMessage
        }

        if (backendResponse.status === 0 || backendResponse.status >= 500) {
          return NextResponse.json(
            {
              error:
                'Backend service is currently unavailable. Please try again later.',
            },
            { status: 503 }
          )
        }

        if (backendResponse.status === 404) {
          return NextResponse.json(
            {
              error:
                'Backend endpoint not found. Please check your backend configuration.',
            },
            { status: 404 }
          )
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: backendResponse.status }
        )
      }

      const responseData = await backendResponse.json()

      const aiMessage =
        responseData.message ||
        responseData.content ||
        responseData.response ||
        responseData.text ||
        (typeof responseData === 'string'
          ? responseData
          : 'I apologize, but I could not generate a response.')

      await persistUserAndAssistant(aiMessage)
      return NextResponse.json({ message: aiMessage })
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      const err = fetchError as { name?: string; message?: string }
      if (err.name === 'AbortError') {
        return NextResponse.json(
          {
            error:
              'Request timeout. The backend took too long to respond. Please try again.',
          },
          { status: 504 }
        )
      }

      if (
        err.message?.includes('fetch failed') ||
        err.message?.includes('CORS')
      ) {
        return NextResponse.json(
          {
            error:
              'Unable to connect to backend service. Please ensure the backend is running and CORS is properly configured.',
          },
          { status: 503 }
        )
      }

      throw fetchError
    }
  } catch (error: unknown) {
    console.error('Chat API error:', error)
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
