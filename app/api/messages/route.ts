export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AUTH_DISABLED } from '@/lib/config'
import { resolveAnonId } from '@/lib/security/anon-identity'

// Get messages for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const sessionId = searchParams.get('sessionId')
    // Authoritative anonymous identity comes from the signed cookie, never the
    // query string — this closes the forged-anonymousId access path.
    const anonymousId = await resolveAnonId(searchParams.get('anonymousId'))

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let serviceClient
    try {
      serviceClient = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Supabase service credentials are not configured' },
        { status: 500 },
      )
    }

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

    // Fetch the most recent messages (capped) so a very long history never
    // pulls thousands of rows at once, then restore chronological order.
    const { data, error } = await serviceClient
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json((data || []).reverse())
  } catch (error: any) {
    console.error('Messages fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


