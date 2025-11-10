'use client'

import { ChatSession } from '@/types/user'
import { formatRelativeTime } from '@/lib/utils/format'

interface SessionSidebarProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
  isLoading?: boolean
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  isLoading,
}: SessionSidebarProps) {
  return (
    <div className="w-64 border-r border-border bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onNewSession}
          className="w-full px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-secondary-dark transition-colors"
        >
          + New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-text-secondary">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-text-secondary text-sm">
            No chat sessions yet
          </div>
        ) : (
          <div className="p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-secondary/10 border border-secondary'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-text-primary truncate">
                  {session.title || 'New Chat'}
                </div>
                {session.last_message_at && (
                  <div className="text-xs text-text-secondary mt-1">
                    {formatRelativeTime(session.last_message_at)}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

