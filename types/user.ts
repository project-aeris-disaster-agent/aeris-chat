// Type definitions for the application

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  wallet_address: string | null
  ip_address: string | null
  current_location: {
    latitude?: number
    longitude?: number
    city?: string
    country?: string
  } | null
  contact_no: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export interface ChatSession {
  id: string
  user_id: string | null // Nullable for anonymous sessions
  anonymous_id: string | null // Browser session ID for anonymous users
  ip_address: string | null
  title: string | null
  created_at: string
  updated_at: string
  last_message_at: string | null
  metadata: Record<string, unknown>
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export type MessageRole = 'user' | 'assistant' | 'system'

