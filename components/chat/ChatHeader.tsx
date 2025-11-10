'use client'

import { ChatSession } from '@/types/user'
import { useAuth } from '@/contexts/AuthContext'

interface ChatHeaderProps {
  session: ChatSession | undefined
  onNewSession: () => void
}

export function ChatHeader({ session, onNewSession }: ChatHeaderProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="border-b border-border bg-white px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {session?.title || 'New Chat'}
        </h1>
        {session && (
          <p className="text-sm text-text-secondary">
            {session.last_message_at
              ? `Last active: ${new Date(session.last_message_at).toLocaleString()}`
              : 'No messages yet'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white font-medium">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-text-primary">{user.email}</span>
          </div>
        )}
        <button
          onClick={signOut}
          className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

