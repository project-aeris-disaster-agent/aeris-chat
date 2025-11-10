import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session || AUTH_DISABLED) {
    redirect('/chat')
  } else {
    redirect('/login')
  }
}

