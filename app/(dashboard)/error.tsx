'use client'

import { useEffect } from 'react'

/**
 * Route-level error boundary for the chat experience. Without this, a throw in
 * the Chatbot tree blanks the whole page; here we keep the shell and offer a
 * one-tap recovery — important for an emergency app that must stay usable.
 */
export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Chat route error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        The chat hit an unexpected error. Your connection is fine — you can try
        again. For a life-threatening emergency, call your local hotline
        directly.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </button>
    </div>
  )
}
