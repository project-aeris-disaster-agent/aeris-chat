'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Download, ExternalLink, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type BeforeInstallPromptEvent,
  type InstallPromptMode,
  INSTALL_PROMPT_AVAILABLE_EVENT,
  getDeferredInstallPrompt,
  isAndroid,
  isInAppBrowser,
  isIos,
  markInstallPromptSeen,
  markOpenAppPromptSeen,
  markPwaInstalled,
  resolveInstallPromptMode,
  setDeferredInstallPrompt,
} from '@/lib/pwa/install-utils'

export function InstallAppPrompt() {
  const [mode, setMode] = useState<InstallPromptMode | null>(null)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const resolved = resolveInstallPromptMode()
    if (!resolved) return

    setMode(resolved)
    if (resolved === 'install') {
      markInstallPromptSeen()
    } else {
      markOpenAppPromptSeen()
    }
  }, [])

  const visible = mode !== null

  useEffect(() => {
    const root = document.documentElement
    if (visible) {
      root.style.setProperty('--install-prompt-offset', '5.75rem')
    } else {
      root.style.removeProperty('--install-prompt-offset')
    }
    return () => {
      root.style.removeProperty('--install-prompt-offset')
    }
  }, [visible])

  useEffect(() => {
    // Pick up a prompt the early head-script may have already captured.
    setDeferredPrompt(getDeferredInstallPrompt())

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      setDeferredInstallPrompt(promptEvent)
      setDeferredPrompt(promptEvent)
    }
    const onAvailable = () => setDeferredPrompt(getDeferredInstallPrompt())
    const onInstalled = () => {
      markPwaInstalled()
      setDeferredInstallPrompt(null)
      setDeferredPrompt(null)
      setMode(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener(INSTALL_PROMPT_AVAILABLE_EVENT, onAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener(INSTALL_PROMPT_AVAILABLE_EVENT, onAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setMode(null)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        markPwaInstalled()
        setMode(null)
      }
    } finally {
      setDeferredInstallPrompt(null)
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }, [deferredPrompt])

  const handleOpenApp = useCallback(() => {
    setMode(null)
  }, [])

  if (!visible || !mode) return null

  const ios = isIos()
  const android = isAndroid()
  const inApp = isInAppBrowser()
  const canNativeInstall = mode === 'install' && android && deferredPrompt != null

  const title =
    mode === 'open' ? 'Open Aeris Chat' : 'Add Aeris Chat to your home screen'

  const titleId = mode === 'open' ? 'open-app-title' : 'install-app-title'
  const descId = mode === 'open' ? 'open-app-desc' : 'install-app-desc'

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-x-0 bottom-0 z-[95] border-t border-border bg-card/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-lg gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl object-contain"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </p>
          <p id={descId} className="mt-0.5 text-xs text-muted-foreground leading-snug">
            {mode === 'open' ? (
              <>
                Aeris is on your home screen. Open the{' '}
                <strong className="font-medium text-foreground">Aeris</strong> shortcut
                from your home screen instead of the browser.
              </>
            ) : inApp && ios ? (
              <>
                Open this page in <strong className="font-medium text-foreground">Safari</strong>,
                then use Share → Add to Home Screen.
              </>
            ) : ios ? (
              <>
                Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden />{' '}
                <strong className="font-medium text-foreground">Share</strong>, then{' '}
                <strong className="font-medium text-foreground">Add to Home Screen</strong>.
              </>
            ) : canNativeInstall ? (
              'Install a shortcut that opens Aeris like an app — no app store required.'
            ) : (
              <>
                Open the browser menu (
                <span className="font-medium text-foreground">⋮</span>) and choose{' '}
                <strong className="font-medium text-foreground">Install app</strong> or{' '}
                <strong className="font-medium text-foreground">Add to Home screen</strong>.
              </>
            )}
          </p>
          {mode === 'open' ? (
            <Button
              type="button"
              size="sm"
              className="mt-2 h-8 gap-1.5"
              onClick={handleOpenApp}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open app
            </Button>
          ) : (
            canNativeInstall && (
              <Button
                type="button"
                size="sm"
                className="mt-2 h-9 w-full gap-1.5 font-semibold"
                disabled={installing}
                onClick={handleInstall}
              >
                <Download className="h-4 w-4" aria-hidden />
                {installing ? 'Installing…' : 'Install app — one tap'}
              </Button>
            )
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          aria-label={mode === 'open' ? 'Dismiss open app prompt' : 'Dismiss install prompt'}
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
