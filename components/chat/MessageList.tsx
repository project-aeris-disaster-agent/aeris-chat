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
    </div>
  )
}

