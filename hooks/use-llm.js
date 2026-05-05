'use client'

import { useState, useCallback, useEffect } from 'react'

/** @type {string} */
const LS_CONVERSATION_ID = 'llm_api_conversation_id'

/**
 * @param {string} conversationId
 * @returns {string}
 */
function messagesStorageKey(conversationId) {
  return `llm_api_messages_${conversationId}`
}

/**
 * Normalize base URL (no trailing slash).
 * @param {string} url
 * @returns {string}
 */
function normalizeBaseUrl(url) {
  return (url || '').replace(/\/+$/, '')
}

/**
 * @typedef {'user' | 'assistant'} MessageRole
 */

/**
 * @typedef {object} LLMChatMessage
 * @property {MessageRole} role
 * @property {string} content
 */

/**
 * Token usage returned by the chat API.
 * @typedef {object} ChatUsage
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 */

/**
 * Successful response from POST /api/chat.
 * @typedef {object} ChatResponse
 * @property {string} conversationId
 * @property {string} message
 * @property {string} timestamp
 * @property {ChatUsage} [usage]
 */

/**
 * Conversation snapshot (from memory + localStorage; backend has no list endpoint in this setup).
 * @typedef {object} Conversation
 * @property {string} id
 * @property {LLMChatMessage[]} messages
 */

/**
 * Options for {@link useLLM}.
 * @typedef {object} UseLLMOptions
 * @property {string} [apiUrl] Default: `process.env.NEXT_PUBLIC_LLM_API_URL`
 * @property {string} [apiKey] Default: `process.env.NEXT_PUBLIC_LLM_API_KEY`
 * @property {string} [defaultSystemPrompt]
 * @property {boolean} [autoSaveConversation] Default: `true`
 */

/**
 * Optional overrides when sending a message.
 * @typedef {object} SendMessageOptions
 * @property {string} [systemPrompt]
 * @property {number} [temperature]
 * @property {string} [conversationId] Override the active conversation id for this request only
 */

/**
 * @typedef {object} UseLLMReturn
 * @property {boolean} loading
 * @property {string | null} error
 * @property {string | null} conversationId
 * @property {LLMChatMessage[]} messages
 * @property {boolean} isInitialized
 * @property {(message: string, options?: SendMessageOptions) => Promise<ChatResponse>} sendMessage
 * @property {(id: string) => Promise<Conversation>} loadConversation
 * @property {(id?: string) => Promise<void>} deleteConversation
 * @property {() => void} resetConversation
 * @property {() => void} clearError
 */

/**
 * React hook for the external LLM HTTP API (health + chat).
 * Persists the active `conversationId` (and message history when enabled) in `localStorage`.
 *
 * @param {UseLLMOptions} [options]
 * @returns {UseLLMReturn}
 */
export function useLLM(options = {}) {
  const {
    apiUrl: apiUrlOption,
    apiKey: apiKeyOption,
    defaultSystemPrompt = '',
    autoSaveConversation = true,
  } = options

  const baseUrl = normalizeBaseUrl(
    apiUrlOption ?? process.env.NEXT_PUBLIC_LLM_API_URL ?? ''
  )
  const apiKey = apiKeyOption ?? process.env.NEXT_PUBLIC_LLM_API_KEY ?? ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [conversationId, setConversationId] = useState(
    /** @type {string | null} */ (null)
  )
  const [messages, setMessages] = useState(/** @type {LLMChatMessage[]} */ ([]))
  const [isInitialized, setIsInitialized] = useState(false)

  /** Hydrate conversation id and messages from localStorage once on the client. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (autoSaveConversation) {
        const savedId = localStorage.getItem(LS_CONVERSATION_ID)
        if (savedId) {
          setConversationId(savedId)
          const raw = localStorage.getItem(messagesStorageKey(savedId))
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              setMessages(
                parsed.filter(
                  (m) =>
                    m &&
                    (m.role === 'user' || m.role === 'assistant') &&
                    typeof m.content === 'string'
                )
              )
            }
          }
        }
      }
    } catch (e) {
      console.warn('useLLM: failed to read from localStorage', e)
    } finally {
      setIsInitialized(true)
    }
  }, [autoSaveConversation])

  /** Persist conversation id and messages whenever they change. */
  useEffect(() => {
    if (!isInitialized || !autoSaveConversation || typeof window === 'undefined') {
      return
    }
    try {
      if (conversationId) {
        localStorage.setItem(LS_CONVERSATION_ID, conversationId)
        localStorage.setItem(
          messagesStorageKey(conversationId),
          JSON.stringify(messages)
        )
      } else {
        localStorage.removeItem(LS_CONVERSATION_ID)
      }
    } catch (e) {
      console.warn('useLLM: failed to write to localStorage', e)
    }
  }, [conversationId, messages, autoSaveConversation, isInitialized])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Replace active conversation and load any cached messages for `id`.
   * @param {string} id
   * @returns {Promise<Conversation>}
   */
  const loadConversation = useCallback(async (id) => {
    setError(null)
    setConversationId(id)
    if (typeof window === 'undefined') {
      return { id, messages: [] }
    }
    try {
      const raw = localStorage.getItem(messagesStorageKey(id))
      const parsed = raw ? JSON.parse(raw) : []
      const next =
        Array.isArray(parsed) &&
        parsed.filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
      setMessages(next)
      return { id, messages: next }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Failed to load conversation'
      setError(message)
      setMessages([])
      throw e
    }
  }, [])

  /**
   * Remove a conversation from local storage. Defaults to the active id.
   * @param {string} [id]
   * @returns {Promise<void>}
   */
  const deleteConversation = useCallback(
    async (id) => {
      const targetId = id ?? conversationId
      if (!targetId || typeof window === 'undefined') return
      try {
        localStorage.removeItem(messagesStorageKey(targetId))
        if (conversationId === targetId) {
          localStorage.removeItem(LS_CONVERSATION_ID)
          setConversationId(null)
          setMessages([])
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to delete conversation'
        setError(message)
        throw e
      }
    },
    [conversationId]
  )

  /** Clear client state and localStorage for the active thread. */
  const resetConversation = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        if (conversationId) {
          localStorage.removeItem(messagesStorageKey(conversationId))
        }
        localStorage.removeItem(LS_CONVERSATION_ID)
      } catch (e) {
        console.warn('useLLM: reset localStorage failed', e)
      }
    }
    setConversationId(null)
    setMessages([])
    setError(null)
  }, [conversationId])

  /**
   * Send a user message to POST /api/chat and append the assistant reply to `messages`.
   * @param {string} message
   * @param {SendMessageOptions} [sendOpts]
   * @returns {Promise<ChatResponse>}
   */
  const sendMessage = useCallback(
    async (message, sendOpts = {}) => {
      const trimmed = message?.trim()
      if (!trimmed) {
        const err = 'Message cannot be empty'
        setError(err)
        throw new Error(err)
      }
      if (!baseUrl) {
        const err = 'NEXT_PUBLIC_LLM_API_URL is not configured'
        setError(err)
        throw new Error(err)
      }

      setLoading(true)
      setError(null)

      const userMsg = /** @type {LLMChatMessage} */ ({
        role: 'user',
        content: trimmed,
      })
      setMessages((prev) => [...prev, userMsg])

      const effectiveConversationId =
        sendOpts.conversationId ?? conversationId ?? undefined
      const temperature =
        typeof sendOpts.temperature === 'number' ? sendOpts.temperature : 0.7
      const systemPrompt =
        sendOpts.systemPrompt ?? defaultSystemPrompt ?? ''

      /** @type {Record<string, unknown>} */
      const body = {
        message: trimmed,
        temperature,
      }
      if (effectiveConversationId) {
        body.conversationId = effectiveConversationId
      }
      if (systemPrompt) {
        body.systemPrompt = systemPrompt
      }

      /** @type {HeadersInit} */
      const headers = { 'Content-Type': 'application/json' }
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`
      }

      try {
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        const text = await res.text()
        /** @type {unknown} */
        let data
        try {
          data = text ? JSON.parse(text) : null
        } catch {
          data = null
        }

        if (!res.ok) {
          let serverMsg = `Request failed (${res.status})`
          if (data && typeof data === 'object') {
            const o = /** @type {Record<string, unknown>} */ (data)
            if (typeof o.message === 'string' && o.message) {
              serverMsg = o.message
            } else if (typeof o.error === 'string' && o.error) {
              serverMsg = o.error
            }
          } else if (text) {
            serverMsg = text
          }
          setError(serverMsg)
          throw new Error(serverMsg)
        }

        if (
          !data ||
          typeof data !== 'object' ||
          typeof /** @type {ChatResponse} */ (data).conversationId !==
            'string' ||
          typeof /** @type {ChatResponse} */ (data).message !== 'string'
        ) {
          const err = 'Invalid response from chat API'
          setError(err)
          throw new Error(err)
        }

        /** @type {ChatResponse} */
        const chatResponse = /** @type {ChatResponse} */ (data)
        setConversationId(chatResponse.conversationId)

        const assistantMsg = /** @type {LLMChatMessage} */ ({
          role: 'assistant',
          content: chatResponse.message,
        })
        setMessages((prev) => [...prev, assistantMsg])

        return chatResponse
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Failed to send message'
        setError(message)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [apiKey, baseUrl, conversationId, defaultSystemPrompt]
  )

  return {
    loading,
    error,
    conversationId,
    messages,
    isInitialized,
    sendMessage,
    loadConversation,
    deleteConversation,
    resetConversation,
    clearError,
  }
}
