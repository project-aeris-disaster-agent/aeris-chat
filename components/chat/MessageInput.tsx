'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  disabled?: boolean
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [message])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isSending || disabled) return

    const messageToSend = message.trim()
    setMessage('')
    setIsSending(true)

    try {
      await onSend(messageToSend)
    } catch (error) {
      console.error('Error sending message:', error)
      // Restore message on error
      setMessage(messageToSend)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="border-t border-border bg-white p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
            rows={1}
            disabled={isSending || disabled}
            style={{ minHeight: '48px', maxHeight: '200px', overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={!message.trim() || isSending || disabled}
            className="px-6 py-3 bg-secondary text-white rounded-lg font-medium hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

