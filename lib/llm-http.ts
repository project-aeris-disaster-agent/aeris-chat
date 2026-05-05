/**
 * Server-side helpers for the external LLM HTTP API (`POST /api/chat`, `GET /health`).
 * Used by `app/api/chat/route.ts` so the main chat UI keeps using Supabase while the model runs elsewhere.
 */

export type LlmHttpChatResponse = {
  conversationId: string
  message: string
  timestamp?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export class LlmHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'LlmHttpError'
    this.status = status
  }
}

/**
 * Base URL for the LLM API (no trailing slash).
 * `LLM_HTTP_API_BASE_URL` wins so production can point at a private URL while the client uses a different public URL if needed.
 */
export function getLlmHttpBaseUrl(): string | null {
  const raw =
    process.env.LLM_HTTP_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_LLM_API_URL?.trim() ||
    ''
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

/** Bearer token for the LLM HTTP API, if required. */
export function getLlmHttpApiKey(): string | undefined {
  const k =
    process.env.LLM_HTTP_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_LLM_API_KEY?.trim()
  return k || undefined
}

function parseTemperature(): number {
  const raw = process.env.LLM_TEMPERATURE?.trim()
  if (!raw) return 0.7
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0.7
}

function getSystemPrompt(): string | undefined {
  const s = process.env.LLM_SYSTEM_PROMPT?.trim()
  return s || undefined
}

/**
 * Calls `POST {baseUrl}/api/chat` with the contract used by the tunnel / local LLM server.
 */
export async function callLlmHttpChat(params: {
  baseUrl: string
  apiKey?: string
  message: string
  conversationId?: string
  signal?: AbortSignal
}): Promise<LlmHttpChatResponse> {
  const { baseUrl, apiKey, message, conversationId, signal } = params
  const body: Record<string, unknown> = {
    message,
    temperature: parseTemperature(),
  }
  const systemPrompt = getSystemPrompt()
  if (systemPrompt) body.systemPrompt = systemPrompt
  if (conversationId) body.conversationId = conversationId

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    let msg = `LLM HTTP error (${res.status})`
    if (data && typeof data === 'object') {
      const o = data as Record<string, unknown>
      if (typeof o.error === 'string') msg = o.error
      else if (typeof o.message === 'string') msg = o.message
    } else if (text) msg = text
    throw new LlmHttpError(msg, res.status)
  }

  if (
    !data ||
    typeof data !== 'object' ||
    typeof (data as LlmHttpChatResponse).conversationId !== 'string' ||
    typeof (data as LlmHttpChatResponse).message !== 'string'
  ) {
    throw new Error('Invalid JSON from LLM HTTP API')
  }

  return data as LlmHttpChatResponse
}
