import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, messages } = body

    // Validate input
    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request. sessionId and messages array are required.' },
        { status: 400 }
      )
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // TODO: Call your LLM API here
    // For now, return a placeholder response
    const llmApiUrl = process.env.NEXT_PUBLIC_LLM_API_URL
    const llmApiKey = process.env.LLM_API_KEY

    if (!llmApiUrl || !llmApiKey) {
      // Return a mock response for development
      return NextResponse.json({
        message: 'LLM API is not configured. Please set NEXT_PUBLIC_LLM_API_URL and LLM_API_KEY in your environment variables.',
      })
    }

    // Call your LLM API
    const llmResponse = await fetch(llmApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    })

    if (!llmResponse.ok) {
      const error = await llmResponse.json()
      return NextResponse.json(
        { error: error.message || 'Failed to get AI response' },
        { status: llmResponse.status }
      )
    }

    const llmData = await llmResponse.json()
    const aiMessage = llmData.message || llmData.content || llmData.response || 'I apologize, but I could not generate a response.'

    return NextResponse.json({ message: aiMessage })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

