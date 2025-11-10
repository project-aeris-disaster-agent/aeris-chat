// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          wallet_address: string | null
          ip_address: string | null
          current_location: Record<string, unknown> | null
          contact_no: string | null
          created_at: string
          updated_at: string
          metadata: Record<string, unknown>
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          wallet_address?: string | null
          ip_address?: string | null
          current_location?: Record<string, unknown> | null
          contact_no?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Record<string, unknown>
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          wallet_address?: string | null
          ip_address?: string | null
          current_location?: Record<string, unknown> | null
          contact_no?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Record<string, unknown>
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          ip_address: string | null
          title: string | null
          created_at: string
          updated_at: string
          last_message_at: string | null
          metadata: Record<string, unknown>
        }
        Insert: {
          id?: string
          user_id: string
          ip_address?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          metadata?: Record<string, unknown>
        }
        Update: {
          id?: string
          user_id?: string
          ip_address?: string | null
          title?: string | null
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          metadata?: Record<string, unknown>
        }
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at: string
          updated_at: string
          metadata: Record<string, unknown>
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at?: string
          updated_at?: string
          metadata?: Record<string, unknown>
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          created_at?: string
          updated_at?: string
          metadata?: Record<string, unknown>
        }
      }
    }
  }
}

