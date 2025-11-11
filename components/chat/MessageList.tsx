'use client'

import { Message } from '@/types/user'
import { MessageItem } from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  selectedColors?: number[][]
}

export function MessageList({ messages, isLoading, selectedColors }: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} selectedColors={selectedColors} />
      ))}
      {isLoading && (
        <div className="flex items-center gap-2 text-text-secondary">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-secondary border-t-transparent"></div>
          <span>AI is thinking...</span>
        </div>
      )}
    </div>
  )
}

