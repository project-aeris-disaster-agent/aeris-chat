'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { SessionSidebar } from './SessionSidebar'
import { ChatHeader } from './ChatHeader'
import { useChat } from '@/hooks/useChat'
import { useSessions } from '@/hooks/useSessions'

export function ChatWindow() {
  const { user } = useAuth()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const { sessions, createSession, isLoading: sessionsLoading } = useSessions()
  const { messages, sendMessage, isLoading: messagesLoading } = useChat(currentSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create a new session if none exists
  useEffect(() => {
    if (!sessionsLoading && sessions.length === 0 && !currentSessionId) {
      handleNewSession()
    } else if (sessions.length > 0 && !currentSessionId) {
      // Use the most recent session
      setCurrentSessionId(sessions[0].id)
    }
  }, [sessions, sessionsLoading, currentSessionId])

  const handleNewSession = async () => {
    const newSession = await createSession()
    if (newSession) {
      setCurrentSessionId(newSession.id)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!currentSessionId) {
      // Create session if none exists
      const newSession = await createSession()
      if (newSession) {
        setCurrentSessionId(newSession.id)
        await sendMessage(content, newSession.id)
      }
    } else {
      await sendMessage(content, currentSessionId)
    }
  }

  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className="flex h-screen bg-primary">
      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewSession={handleNewSession}
        isLoading={sessionsLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <ChatHeader
          session={currentSession}
          onNewSession={handleNewSession}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 && !messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-text-primary mb-2">Start a conversation</h2>
                <p className="text-text-secondary">Send a message to begin chatting with the AI</p>
              </div>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={messagesLoading} />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <MessageInput
          onSend={handleSendMessage}
          disabled={messagesLoading}
        />
      </div>
    </div>
  )
}

