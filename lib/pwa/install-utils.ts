export const PWA_INSTALLED_KEY = 'aeris-pwa-installed'
export const INSTALL_PROMPT_SEEN_KEY = 'aeris-install-prompt-seen'
export const OPEN_APP_PROMPT_SEEN_KEY = 'aeris-open-app-prompt-seen'

export type InstallPromptMode = 'install' | 'open'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Chrome/Android can fire `beforeinstallprompt` before React mounts. An inline
 * script in the document head stashes the event on `window` so we never miss
 * it; these helpers read/clear that stash and notify listeners.
 */
const DEFERRED_PROMPT_KEY = '__aerisDeferredInstallPrompt'
export const INSTALL_PROMPT_AVAILABLE_EVENT = 'aeris:install-available'

type WindowWithPrompt = Window & {
  [DEFERRED_PROMPT_KEY]?: BeforeInstallPromptEvent | null
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null
  return (window as WindowWithPrompt)[DEFERRED_PROMPT_KEY] ?? null
}

export function setDeferredInstallPrompt(
  event: BeforeInstallPromptEvent | null,
): void {
  if (typeof window === 'undefined') return
  ;(window as WindowWithPrompt)[DEFERRED_PROMPT_KEY] = event
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true
  return navigator.maxTouchPoints > 1 && window.innerWidth < 1024
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  )
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp/i.test(navigator.userAgent)
}

export function hasPwaInstalled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PWA_INSTALLED_KEY) === '1'
}

export function markPwaInstalled(): void {
  localStorage.setItem(PWA_INSTALLED_KEY, '1')
}

export function wasInstallPromptSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(INSTALL_PROMPT_SEEN_KEY) === '1'
}

export function markInstallPromptSeen(): void {
  localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, '1')
}

export function wasOpenAppPromptSeen(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(OPEN_APP_PROMPT_SEEN_KEY) === '1'
}

export function markOpenAppPromptSeen(): void {
  localStorage.setItem(OPEN_APP_PROMPT_SEEN_KEY, '1')
}

/** Decide which one-time mobile banner to show, if any. */
export function resolveInstallPromptMode(): InstallPromptMode | null {
  if (!isMobileDevice()) return null

  if (isInstalledPwa()) {
    markPwaInstalled()
    return null
  }

  if (hasPwaInstalled()) {
    if (wasOpenAppPromptSeen()) return null
    return 'open'
  }

  if (wasInstallPromptSeen()) return null
  return 'install'
}
