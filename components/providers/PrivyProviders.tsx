'use client'

import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? ''

/**
 * Wraps the app with Privy auth using the SAME app id as the AERIS dashboard,
 * so the same DID resolves in both products and profile / XP / level persist
 * across them. When the app id is missing, this is a transparent pass-through
 * (AERIS CHAT stays fully usable anonymously).
 */
export function PrivyProviders({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['google'],
        appearance: {
          theme: 'light',
          accentColor: '#1695FF',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
