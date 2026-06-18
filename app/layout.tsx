import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { PrivyProviders } from '@/components/providers/PrivyProviders'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProfileProvider } from '@/contexts/ProfileContext'
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
      <head>
        {/*
          Capture the install prompt before React hydrates. Android can dispatch
          `beforeinstallprompt` during initial load, well before the install UI
          mounts, so we stash it on `window` and re-broadcast for the prompt UI.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__aerisDeferredInstallPrompt = event;
    window.dispatchEvent(new Event('aeris:install-available'));
  });
  window.addEventListener('appinstalled', function () {
    window.__aerisDeferredInstallPrompt = null;
    try { localStorage.setItem('aeris-pwa-installed', '1'); } catch (e) {}
  });
})();
            `.trim(),
          }}
        />
      </head>
      <body className="h-app overflow-hidden">
        <Providers>
          <PrivyProviders>
            <AuthProvider>
              <ProfileProvider>
                <PwaRegistrar />
                {children}
                <InstallAppPrompt />
              </ProfileProvider>
            </AuthProvider>
          </PrivyProviders>
        </Providers>
      </body>
    </html>
  )
}

