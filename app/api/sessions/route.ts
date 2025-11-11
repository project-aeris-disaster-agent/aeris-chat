export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'
import { getClientIP } from '@/lib/utils/anonymous-session'

// Create session API route
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { title, anonymousId } = body
    
    let userId: string | null = null
    let sessionAnonymousId: string | null = null

    // Determine user attribution
    if (!AUTH_DISABLED) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Authenticated user
        userId = user.id
      } else if (anonymousId) {
        // Anonymous session
        sessionAnonymousId = anonymousId
      } else {
        return NextResponse.json(
          { error: 'Unauthorized. Please authenticate or provide anonymousId.' },
          { status: 401 }
        )
      }
    } else {
      // AUTH_DISABLED: always anonymous
      if (!anonymousId) {
        return NextResponse.json(
          { error: 'anonymousId is required when auth is disabled' },
          { status: 400 }
        )
      }
      sessionAnonymousId = anonymousId
    }

    const ipAddress = getClientIP(request)

    // Use service role client for inserts
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

    const { data, error } = await serviceClient
      .from('chat_sessions')
      .insert({
        user_id: userId, // null for anonymous
        anonymous_id: sessionAnonymousId, // browser session ID
        title: title || null,
        ip_address: ipAddress,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get sessions API route
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const anonymousId = searchParams.get('anonymousId')
    
    let userId: string | null = null
    let sessionAnonymousId: string | null = null

    if (!AUTH_DISABLED) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Authenticated user
        userId = user.id
      } else if (anonymousId) {
        // Anonymous session
        sessionAnonymousId = anonymousId
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else {
      // AUTH_DISABLED: always anonymous
      if (!anonymousId) {
        return NextResponse.json(
          { error: 'anonymousId is required' },
          { status: 400 }
        )
      }
      sessionAnonymousId = anonymousId
    }

    // Use service role client for queries
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

    let query = serviceClient.from('chat_sessions').select('*')

    if (userId) {
      // Authenticated: get sessions for this user
      query = query.eq('user_id', userId).is('anonymous_id', null)
    } else if (sessionAnonymousId) {
      // Anonymous: get sessions for this anonymous ID
      query = query.eq('anonymous_id', sessionAnonymousId).is('user_id', null)
    }

    const { data, error } = await query
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Sessions fetch error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


