'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AnimatedBlobs } from '@/components/ui'
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
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="ai-loading-indicator"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center gap-4 py-6"
          >
            <AnimatedBlobs
              colors={selectedColors}
              size="12rem"
              speedSeconds={7}
              className="pointer-events-none opacity-90"
            />
            <p className="text-sm font-medium text-muted-foreground">AI is thinking...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

