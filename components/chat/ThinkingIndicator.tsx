'use client'

import { useEffect, useState } from 'react'

/**
 * Visible "thinking" label with a JS-driven ellipsis.
 * CSS animations alone can look frozen when OS reduced-motion is on
 * (this app also globally disables CSS animations in that mode).
 */
export function ThinkingIndicator() {
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setDots((n) => (n + 1) % 4)
    }, 400)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="AI is thinking"
      className="text-sm text-muted-foreground"
    >
      <span>AI is thinking{'.'.repeat(dots)}</span>
      <span className="inline-block w-[1.25em]" aria-hidden="true" />
    </div>
  )
}
