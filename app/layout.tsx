import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { AuthProvider } from '@/contexts/AuthContext'
import { InstallAppPrompt } from '@/components/InstallAppPrompt'
import { PwaRegistrar } from '@/components/PwaRegistrar'

export const metadata: Metadata = {
  title: 'Aeris Chat - AI Chatbot',
  description: 'AI Chatbot web application with session management',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Aeris Chat',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-app overflow-hidden">
      <body className="h-app overflow-hidden">
        <Providers>
          <AuthProvider>
            <PwaRegistrar />
            {children}
            <InstallAppPrompt />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}

