'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/types/user'
import { AUTH_DISABLED } from '@/lib/config'
import { getAnonymousSessionId } from '@/lib/utils/anonymous-session'

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
    mutationFn: async ({ content, sessionId: sid }: { content: string; sessionId: string }) => {
      console.log('useChat: Starting sendMessage mutation', { content, sessionId: sid });
      
      // Get anonymous session ID if needed
      const anonymousId = getAnonymousSessionId()
      
      if (!AUTH_DISABLED) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Authenticated: insert user message directly
          console.log('useChat: Inserting user message...');
          const { data: userMessage, error: userError } = await supabase
            .from('messages')
            .insert({
              session_id: sid,
              role: 'user',
              content,
            })
            .select()
            .single()

          if (userError) {
            console.error('useChat: Error inserting user message:', userError);
            throw userError
          }
          
          console.log('useChat: User message inserted:', userMessage);
        } else {
          // Not authenticated: API route will handle message insertion
          console.log('useChat: Not authenticated - API route will handle message insertion');
        }
      } else {
        console.log('useChat: AUTH_DISABLED - API route will handle message insertion');
      }

      // Call API to get AI response
      console.log('useChat: Calling /api/chat endpoint...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sid,
          anonymousId: anonymousId || undefined, // Only send if exists
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
        }),
      })

      console.log('useChat: API response status:', response.status);

      if (!response.ok) {
        const error = await response.json()
        console.error('useChat: API error:', error);
        throw new Error(error.error || error.message || 'Failed to get AI response')
      }

      const { message: aiMessage } = await response.json()
      console.log('useChat: AI response received:', aiMessage);

      // Insert AI response only if authenticated (API route handles it for anonymous)
      if (!AUTH_DISABLED) {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          console.log('useChat: Inserting AI response...');
          const { data: assistantMessage, error: assistantError } = await supabase
            .from('messages')
            .insert({
              session_id: sid,
              role: 'assistant',
              content: aiMessage,
            })
            .select()
            .single()

          if (assistantError) {
            console.error('useChat: Error inserting assistant message:', assistantError);
            throw assistantError
          }
          
          console.log('useChat: Assistant message inserted:', assistantMessage);
          return { userMessage: null, assistantMessage }
        }
      }

      // When anonymous or AUTH_DISABLED, API route handles message insertion
      return { userMessage: null, assistantMessage: null }
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


