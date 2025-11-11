import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'

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

    const body = await request.json()
    const { sessionId, messages, anonymousId } = body

    // Validate input
    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request. sessionId and messages array are required.' },
        { status: 400 }
      )
    }

    // Use service role client to verify session access
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

    // Verify session belongs to user or is anonymous
    const { data: session, error: sessionError } = await serviceClient
      .from('chat_sessions')
      .select('user_id, anonymous_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check access: authenticated user OR anonymous session
    if (user && session.user_id === user.id) {
      // Authenticated user owns session - proceed
    } else if (!user && session.anonymous_id && anonymousId === session.anonymous_id) {
      // Anonymous session matches - proceed
    } else if (AUTH_DISABLED && session.anonymous_id && anonymousId === session.anonymous_id) {
      // AUTH_DISABLED mode with matching anonymous ID - proceed
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Flask backend URL and API key from environment variables
    const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
    const backendUrl = `${backendBaseUrl}/api/llm/chat`
    const apiKey = process.env.LLM_API_KEY

    if (!backendBaseUrl) {
      return NextResponse.json(
        { error: 'Backend API is not configured. Please set NEXT_PUBLIC_BACKEND_API_URL in your environment variables.' },
        { status: 500 }
      )
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'LLM_API_KEY is not configured. Please set LLM_API_KEY in your environment variables.' },
        { status: 500 }
      )
    }

    // Prepare messages for Flask backend
    const requestBody = {
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    }

    // Call Flask backend with timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

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

      // Handle non-OK responses
      if (!backendResponse.ok) {
        let errorMessage = 'Failed to get AI response from backend'
        
        try {
          const errorData = await backendResponse.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          // If response is not JSON, use status text
          errorMessage = backendResponse.statusText || errorMessage
        }

        // Handle specific error cases
        if (backendResponse.status === 0 || backendResponse.status >= 500) {
          return NextResponse.json(
            { error: 'Backend service is currently unavailable. Please try again later.' },
            { status: 503 }
          )
        }

        if (backendResponse.status === 404) {
          return NextResponse.json(
            { error: 'Backend endpoint not found. Please check your backend configuration.' },
            { status: 404 }
          )
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: backendResponse.status }
        )
      }

      // Parse successful response
      const responseData = await backendResponse.json()
      
      // Handle various response formats from Flask backend
      const aiMessage = responseData.message || 
                       responseData.content || 
                       responseData.response || 
                       responseData.text ||
                       (typeof responseData === 'string' ? responseData : 'I apologize, but I could not generate a response.')

      // Insert messages using service role (already created above)

      // Insert user message (if not already inserted by frontend)
      const userMessageContent = messages[messages.length - 1]?.content
      if (userMessageContent) {
        try {
          await serviceClient
            .from('messages')
            .insert({
              session_id: sessionId,
              role: 'user',
              content: userMessageContent,
            })
        } catch (err) {
          // Message might already exist, ignore
          console.log('User message may already exist')
        }
      }

      // Insert AI response
      const { data: assistantMessage, error: assistantError } = await serviceClient
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
        // Still return the message even if DB insert fails
      }

      return NextResponse.json({ message: aiMessage })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)

      // Handle timeout errors
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout. The backend took too long to respond. Please try again.' },
          { status: 504 }
        )
      }

      // Handle network/CORS errors
      if (fetchError.message?.includes('fetch failed') || fetchError.message?.includes('CORS')) {
        return NextResponse.json(
          { error: 'Unable to connect to backend service. Please ensure the backend is running and CORS is properly configured.' },
          { status: 503 }
        )
      }

      // Re-throw other errors to be caught by outer catch block
      throw fetchError
    }
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

