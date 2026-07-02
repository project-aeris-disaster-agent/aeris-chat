'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePrivy } from '@privy-io/react-auth'

export type ClientUserProfile = {
  userId: string
  email: string | null
  username: string
  proxyWalletAddress: string | null
  walletChain: string
  barangay: string | null
  phone: string | null
  socials: Record<string, string>
  avatarUrl: string | null
  xp: number
  level: number
  createdAt: string
  updatedAt: string
}

export type ProfileUpdateInput = {
  username?: string
  barangay?: string | null
  phone?: string | null
  socials?: Record<string, string>
  avatar_url?: string | null
}

export type ProfileUpdateResult =
  | { ok: true; profile: ClientUserProfile }
  | { ok: false; error: string }

type ProfileState = {
  profile: ClientUserProfile | null
  loading: boolean
  /** True once Privy has resolved its session state. */
  ready: boolean
  authenticated: boolean
  /** True when Privy is configured for this deployment. */
  privyEnabled: boolean
  login: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateProfile: (input: ProfileUpdateInput) => Promise<ProfileUpdateResult>
}

const ProfileContext = createContext<ProfileState | null>(null)

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? ''

// Usage-time heartbeat cadence. The server only awards once per 15-min bucket,
// so pinging more often just keeps totals current without farming XP.
const HEARTBEAT_MS = 3 * 60 * 1000

/**
 * Wires the chat client to the shared profile/XP system. Privy stores the
 * access token in the `privy-token` cookie, which the server routes verify, so
 * these fetches need no explicit Authorization header.
 */
function PrivyProfileProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const [profile, setProfile] = useState<ClientUserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const syncedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { profile?: ClientUserProfile }
      if (data.profile) setProfile(data.profile)
    } catch {
      // Non-fatal: profile UI degrades to "unavailable".
    }
  }, [])

  // Sync (create-if-missing) once per authenticated session, then load profile.
  useEffect(() => {
    if (!ready || !authenticated || syncedRef.current) return
    syncedRef.current = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/user/sync', {
          method: 'POST',
          cache: 'no-store',
        })
        if (res.ok) {
          const data = (await res.json()) as { profile?: ClientUserProfile }
          if (data.profile) {
            setProfile(data.profile)
            return
          }
        }
        await refresh()
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    })()
  }, [ready, authenticated, refresh])

  // Reset when the signed-in identity changes (login / logout / switch).
  useEffect(() => {
    syncedRef.current = false
    setProfile(null)
  }, [user?.id])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<ProfileUpdateResult> => {
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = (await res.json().catch(() => ({}))) as {
          profile?: ClientUserProfile
          error?: string
        }
        if (!res.ok || !data.profile) {
          return { ok: false, error: data.error ?? 'Failed to update profile.' }
        }
        setProfile(data.profile)
        return { ok: true, profile: data.profile }
      } catch {
        return { ok: false, error: 'Network error. Please try again.' }
      }
    },
    [],
  )

  // Usage-time heartbeat while the tab is visible.
  useEffect(() => {
    if (!ready || !authenticated) return

    let cancelled = false
    const ping = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch('/api/user/activity', {
          method: 'POST',
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          awarded?: boolean
          xp?: number | null
          level?: number | null
        }
        if (!cancelled && data.awarded && typeof data.xp === 'number') {
          setProfile((prev) =>
            prev
              ? { ...prev, xp: data.xp as number, level: data.level ?? prev.level }
              : prev,
          )
        }
      } catch {
        // ignore
      }
    }

    void ping()
    const id = window.setInterval(() => void ping(), HEARTBEAT_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [ready, authenticated])

  const value = useMemo<ProfileState>(
    () => ({
      profile,
      loading,
      ready,
      authenticated: ready && authenticated,
      privyEnabled: true,
      login,
      logout,
      refresh,
      updateProfile,
    }),
    [profile, loading, ready, authenticated, login, logout, refresh, updateProfile],
  )

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}

const DISABLED_STATE: ProfileState = {
  profile: null,
  loading: false,
  ready: true,
  authenticated: false,
  privyEnabled: false,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
  updateProfile: async () => ({ ok: false, error: 'Profiles are unavailable.' }),
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  // When Privy is not configured there is no auth provider mounted, so we must
  // not call usePrivy(). Fall back to a disabled context that keeps the chat
  // fully usable anonymously.
  if (!PRIVY_APP_ID) {
    return (
      <ProfileContext.Provider value={DISABLED_STATE}>
        {children}
      </ProfileContext.Provider>
    )
  }
  return <PrivyProfileProvider>{children}</PrivyProfileProvider>
}

export function useUserProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useUserProfile must be used within ProfileProvider')
  }
  return ctx
}
