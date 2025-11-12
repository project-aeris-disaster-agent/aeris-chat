import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'

// Mark as dynamic to prevent static generation issues
export const dynamic = 'force-dynamic'

export default async function Home() {
  // If auth is disabled, always redirect to chat
  if (AUTH_DISABLED) {
    redirect('/chat')
  }

  try {
    const supabase = await createClient()
    
    // Handle case where Supabase client is null (when auth disabled and no env vars)
    if (!supabase) {
      redirect('/chat')
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      redirect('/chat')
    } else {
      redirect('/login')
    }
  } catch (error) {
    // If Supabase is not configured, redirect to chat (assuming auth is disabled)
    console.error('Supabase initialization error:', error)
    redirect('/chat')
  }
}

