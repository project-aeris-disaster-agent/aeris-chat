import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'

// Get messages for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const anonymousId = searchParams.get('anonymousId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

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

    // Fetch messages
    const { data, error } = await serviceClient
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Messages fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


