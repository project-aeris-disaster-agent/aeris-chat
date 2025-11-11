'use client'

import { Message } from '@/types/user'
import { formatTime } from '@/lib/utils/format'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MessageItemProps {
  message: Message
  selectedColors?: number[][]
}

export function MessageItem({ message, selectedColors }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // Get border color from selectedColors (use first color if available)
  const getBorderColor = () => {
    if (!selectedColors || selectedColors.length === 0) {
      return undefined
    }
    const [r, g, b] = selectedColors[0]
    return `rgb(${r}, ${g}, ${b})`
  }

  const borderColor = getBorderColor()

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-yellow-400/20 border-2 border-yellow-400 text-black dark:bg-yellow-400/20 dark:border-yellow-400 dark:text-white'
            : 'bg-white/30 text-black dark:bg-black/30 dark:text-white border-2'
        }`}
        style={!isUser && borderColor ? { borderColor } : undefined}
      >
        <div className="prose prose-sm max-w-none">
          {isAssistant ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <pre className="bg-gray-900 rounded p-4 overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-sm dark:bg-gray-800" {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <div className="text-xs mt-2 text-black/70 dark:text-white/70">
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  )
}

