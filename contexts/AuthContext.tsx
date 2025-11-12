'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { User as AppUser } from '@/types/user'
import { AUTH_DISABLED } from '@/lib/config'

interface AuthContextType {
  user: User | null
  appUser: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (AUTH_DISABLED) {
      // Skip auth checks when auth is disabled
      setLoading(false)
      return
    }

    // Lazy-load Supabase client only when needed and only on client-side
    let supabase: ReturnType<typeof createClient> | null = null
    try {
      supabase = createClient()
    } catch (error) {
      // If Supabase is not configured, treat as auth disabled
      console.warn('Supabase client creation failed, treating as auth disabled:', error)
      setLoading(false)
      return
    }

    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchAppUser(session.user.id, supabase!)
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Error getting session:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchAppUser(session.user.id, supabase!)
      } else {
        setAppUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchAppUser = async (userId: string, supabaseClient: ReturnType<typeof createClient>) => {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setAppUser(data as AppUser)
    } catch (error) {
      console.error('Error fetching app user:', error)
      // Don't throw - this is non-critical
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (AUTH_DISABLED) return
    
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
      setAppUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const refreshUser = async () => {
    if (AUTH_DISABLED || !user) return
    
    try {
      const supabase = createClient()
      await fetchAppUser(user.id, supabase)
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

