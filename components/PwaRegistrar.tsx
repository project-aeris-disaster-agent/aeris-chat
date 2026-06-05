'use client'

import { useEffect } from 'react'

export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: install UI still works on iOS; Android may omit beforeinstallprompt.
    })
  }, [])

  return null
}
