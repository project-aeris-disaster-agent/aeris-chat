'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/types/user'
import { AUTH_DISABLED } from '@/lib/config'
import { getAnonymousSessionId } from '@/lib/utils/anonymous-session'
import type { ChatLocationPayload } from '@/lib/chat/location-payload'

// The server already trims the LLM context to the most recent turns, so there is
// no reason to ship the entire transcript on every send. Capping the request
// body keeps payloads (and serialization cost) bounded as a conversation grows.
const MAX_CONTEXT_MESSAGES = 20

function makeOptimisticMessage(
  sessionId: string,
  role: Message['role'],
  content: string,
): Message {
  const now = new Date().toISOString()
  return {
    id: `optimistic-${role}-${now}-${Math.random().toString(36).slice(2)}`,
    session_id: sessionId,
    role,
    content,
    created_at: now,
    updated_at: now,
    metadata: {},
  }
}

export function useChat(sessionId: string | null) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch messages for a session
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []

      if (AUTH_DISABLED) {
        // Use API route with anonymous session ID
        const anonymousId = getAnonymousSessionId()
        const response = await fetch(`/api/messages?sessionId=${sessionId}&anonymousId=${anonymousId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch messages')
        }
        return (await response.json()) as Message[]
      }

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Authenticated: use direct Supabase query
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })

        if (error) throw error
        return data as Message[]
      } else {
        // Not authenticated: use anonymous session
        const anonymousId = getAnonymousSessionId()
        const response = await fetch(`/api/messages?sessionId=${sessionId}&anonymousId=${anonymousId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch messages')
        }
        return (await response.json()) as Message[]
      }
    },
    enabled: !!sessionId,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      sessionId: sid,
      location,
    }: {
      content: string
      sessionId: string
      location?: ChatLocationPayload
    }) => {
      // Get anonymous session ID if needed
      const anonymousId = getAnonymousSessionId()

      if (!AUTH_DISABLED) {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Authenticated: insert user message directly
          const { error: userError } = await supabase
            .from('messages')
            .insert({
              session_id: sid,
              role: 'user',
              content,
            })
            .select()
            .single()

          if (userError) throw userError
        }
      }

      // Call API to get AI response. Only the most recent turns are sent.
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sid,
          anonymousId: anonymousId || undefined, // Only send if exists
          location,
          messages: [
            ...messages
              .slice(-MAX_CONTEXT_MESSAGES)
              .map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to get AI response')
      }

      const { message: aiMessage } = await response.json()

      // Insert AI response only if authenticated (API route handles it for anonymous)
      if (!AUTH_DISABLED) {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { error: assistantError } = await supabase
            .from('messages')
            .insert({
              session_id: sid,
              role: 'assistant',
              content: aiMessage,
            })
            .select()
            .single()

          if (assistantError) throw assistantError
        }
      }

      return { aiMessage: typeof aiMessage === 'string' ? aiMessage : '' }
    },
    // Optimistically render the user's message immediately so the input feels
    // instant and we don't depend on a refetch to show what they just typed.
    onMutate: async ({ content, sessionId: sid }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', sid] })
      const previous = queryClient.getQueryData<Message[]>(['messages', sid])
      const optimisticUser = makeOptimisticMessage(sid, 'user', content)
      queryClient.setQueryData<Message[]>(['messages', sid], (old = []) => [
        ...old,
        optimisticUser,
      ])
      return { previous, sid }
    },
    // Append the assistant reply from the response right away, then reconcile
    // canonical rows (real ids) in the background without blocking the UI.
    onSuccess: (data, variables) => {
      if (data.aiMessage) {
        queryClient.setQueryData<Message[]>(['messages', variables.sessionId], (old = []) => [
          ...old,
          makeOptimisticMessage(variables.sessionId, 'assistant', data.aiMessage),
        ])
      }
      queryClient.invalidateQueries({ queryKey: ['messages', variables.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', context.sid], context.previous)
      }
    },
  })

  const sendMessage = async (
    content: string,
    sid: string,
    location?: ChatLocationPayload,
  ) => {
    return sendMessageMutation.mutateAsync({ content, sessionId: sid, location })
  }

  return {
    messages,
    // Initial fetch of a session's messages. Drives the full-screen loader.
    isLoading,
    // A reply is in flight. Drives the inline "AI is thinking…" indicator only,
    // so a multi-second weather answer never blocks the whole screen.
    isSending: sendMessageMutation.isPending,
    sendMessage,
  }
}


