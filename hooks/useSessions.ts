'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChatSession } from '@/types/user'

export function useSessions() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ChatSession[]
    },
  })

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (title?: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get user's IP address (simplified - in production, get from request headers)
      const ipAddress = null // Will be set by API route if needed

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

