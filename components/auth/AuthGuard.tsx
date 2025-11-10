'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AUTH_DISABLED } from '@/lib/config'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const authDisabled = AUTH_DISABLED

  useEffect(() => {
    if (authDisabled) return
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router, authDisabled])

  if (authDisabled) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}

