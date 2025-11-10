'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/types/user'
import { AUTH_DISABLED } from '@/lib/config'

export function useChat(sessionId: string | null) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch messages for a session
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return []

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
    enabled: !!sessionId,
  })

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, sessionId: sid }: { content: string; sessionId: string }) => {
      if (!AUTH_DISABLED) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
      }

      // Insert user message
      const { data: userMessage, error: userError } = await supabase
        .from('messages')
        .insert({
          session_id: sid,
          role: 'user',
          content,
        })
        .select()
        .single()

      if (userError) throw userError

      // Call API to get AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sid,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to get AI response')
      }

      const { message: aiMessage } = await response.json()

      // Insert AI response
      const { data: assistantMessage, error: assistantError } = await supabase
        .from('messages')
        .insert({
          session_id: sid,
          role: 'assistant',
          content: aiMessage,
        })
        .select()
        .single()

      if (assistantError) throw assistantError

      return { userMessage, assistantMessage }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  const sendMessage = async (content: string, sid: string) => {
    return sendMessageMutation.mutateAsync({ content, sessionId: sid })
  }

  return {
    messages,
    isLoading: isLoading || sendMessageMutation.isPending,
    sendMessage,
  }
}

