'use client'

import { useCallback, useState } from 'react'

/**
 * @typedef {{ id: string; at: string; level: 'info' | 'error' | 'success' }} LogEntry
 */

function normalizeBaseUrl(url) {
  return (url || '').replace(/\/+$/, '')
}

/**
 * Admin-style page to verify tunnel + backend from the browser.
 */
export default function TestConnectionPage() {
  const baseUrl = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_LLM_API_URL || ''
  )
  const apiKey = process.env.NEXT_PUBLIC_LLM_API_KEY || ''

  const [status, setStatus] = useState('Idle')
  const [lastPayload, setLastPayload] = useState(
    /** @type {string | null} */ (null)
  )
  const [logs, setLogs] = useState(/** @type {LogEntry[]} */ ([]))

  const appendLog = useCallback((level, message) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      level,
      message,
    }
    setLogs((prev) => [...prev.slice(-199), entry])
  }, [])

  const testHealth = useCallback(async () => {
    if (!baseUrl) {
      setStatus('Missing NEXT_PUBLIC_LLM_API_URL')
      appendLog('error', 'NEXT_PUBLIC_LLM_API_URL is not set')
      return
    }
    setStatus('Testing health…')
    appendLog('info', `GET ${baseUrl}/health`)
    try {
      const headers = /** @type {Record<string, string>} */ ({})
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const res = await fetch(`${baseUrl}/health`, { headers })
      const text = await res.text()
      let parsed = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = text
      }
      setLastPayload(
        typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
      )
      if (!res.ok) {
        setStatus(`Health failed (${res.status})`)
        appendLog('error', `HTTP ${res.status}: ${text}`)
        return
      }
      setStatus('Health OK')
      appendLog('success', 'Health check succeeded')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('Health error')
      setLastPayload(msg)
      appendLog('error', msg)
    }
  }, [appendLog, apiKey, baseUrl])

  const testChat = useCallback(async () => {
    if (!baseUrl) {
      setStatus('Missing NEXT_PUBLIC_LLM_API_URL')
      appendLog('error', 'NEXT_PUBLIC_LLM_API_URL is not set')
      return
    }
    setStatus('Testing chat…')
    appendLog('info', `POST ${baseUrl}/api/chat`)

    const headers = /** @type {Record<string, string>} */ ({
      'Content-Type': 'application/json',
    })
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const body = {
      message: 'Hello from Aeris Chat test page',
      temperature: 0.2,
    }

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let parsed = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = text
      }
      setLastPayload(
        typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
      )
      if (!res.ok) {
        setStatus(`Chat failed (${res.status})`)
        appendLog('error', `HTTP ${res.status}: ${text}`)
        return
      }
      setStatus('Chat OK')
      appendLog('success', 'Chat check succeeded')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('Chat error')
      setLastPayload(msg)
      appendLog('error', msg)
    }
  }, [appendLog, apiKey, baseUrl])

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          LLM connection test
        </h1>
        <p className="text-sm text-muted-foreground">
          Base URL from env:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {baseUrl || '(unset)'}
          </code>
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void testHealth()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Test Health
        </button>
        <button
          type="button"
          onClick={() => void testChat()}
          className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          Test Chat
        </button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-sm font-semibold">Connection status</h2>
        <p className="mt-2 text-sm">{status}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-sm font-semibold">Last response</h2>
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground">
          {lastPayload ?? '—'}
        </pre>
      </section>

      <section className="flex flex-1 flex-col rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Logs</h2>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-background p-2 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground">No entries yet.</p>
          ) : (
            <ul className="space-y-1">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className={
                    l.level === 'error'
                      ? 'text-destructive'
                      : l.level === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground'
                  }
                >
                  <span className="text-muted-foreground">{l.at}</span>{' '}
                  <span className="uppercase">{l.level}</span>: {l.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
