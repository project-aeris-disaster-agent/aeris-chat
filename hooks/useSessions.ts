'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChatSession } from '@/types/user'
import { AUTH_DISABLED } from '@/lib/config'
import { getAnonymousSessionId } from '@/lib/utils/anonymous-session'

export function useSessions() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      if (AUTH_DISABLED) {
        // Use API route with anonymous session ID
        const anonymousId = getAnonymousSessionId()
        const response = await fetch(`/api/sessions?anonymousId=${anonymousId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch sessions')
        }
        return (await response.json()) as ChatSession[]
      }

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Authenticated: use direct Supabase query
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .is('anonymous_id', null)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })

        if (error) throw error
        return data as ChatSession[]
      } else {
        // Not authenticated: use anonymous session
        const anonymousId = getAnonymousSessionId()
        const response = await fetch(`/api/sessions?anonymousId=${anonymousId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch sessions')
        }
        return (await response.json()) as ChatSession[]
      }
    },
  })

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (title?: string) => {
      if (AUTH_DISABLED) {
        // Use API route with anonymous session ID
        const anonymousId = getAnonymousSessionId()
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, anonymousId }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create session')
        }

        return (await response.json()) as ChatSession
      }

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Authenticated: use direct Supabase insert
        const ipAddress = null

        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            user_id: user.id,
            title: title || null,
            ip_address: ipAddress,
          })
          .select()
          .single()

        if (error) throw error
        return data as ChatSession
      } else {
        // Not authenticated: use anonymous session
        const anonymousId = getAnonymousSessionId()
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, anonymousId }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create session')
        }

        return (await response.json()) as ChatSession
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // Update session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title?: string }) => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({ title })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ChatSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return {
    sessions,
    isLoading,
    createSession: createSessionMutation.mutateAsync,
    updateSession: updateSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
  }
}


