'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLLM } from '@/hooks/use-llm'

/**
 * Standalone chat UI wired to {@link useLLM}.
 * User bubbles align right; assistant bubbles align left.
 */
export function ChatComponent() {
  const {
    loading,
    error,
    conversationId,
    messages,
    isInitialized,
    sendMessage,
    resetConversation,
    clearError,
  } = useLLM()

  const [input, setInput] = useState('')
  const bottomRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!input.trim() || loading) return
      const text = input
      setInput('')
      try {
        await sendMessage(text)
      } catch {
        // Error state is handled inside the hook
      }
    },
    [input, loading, sendMessage]
  )

  if (!isInitialized) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card p-6 text-muted-foreground">
        Loading chat…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[420px] w-full max-w-3xl flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">LLM Chat</h2>
          <p className="truncate text-xs text-muted-foreground">
            {conversationId
              ? `Conversation: ${conversationId.slice(0, 8)}…`
              : 'New conversation'}
          </p>
        </div>
        <button
          type="button"
          onClick={resetConversation}
          className="shrink-0 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/80"
        >
          New Chat
        </button>
      </header>

      {error ? (
        <div
          className="mx-3 mt-3 flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 rounded px-2 py-0.5 text-xs font-medium underline-offset-2 hover:underline"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Send a message to talk to the model.
            </p>
          ) : null}
          {messages.map((m, i) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md border border-border bg-muted text-foreground'
                  }`}
                >
                  <span className="whitespace-pre-wrap break-words">
                    {m.content}
                  </span>
                </div>
              </div>
            )
          })}
          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
                <span
                  className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground/70"
                  aria-hidden
                />
                Thinking…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-border bg-card/80 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/60"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-end">
          <label className="sr-only" htmlFor="llm-chat-input">
            Message
          </label>
          <textarea
            id="llm-chat-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void onSubmit(e)
              }
            }}
            placeholder="Type a message… (Shift+Enter for newline)"
            className="min-h-[44px] flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
