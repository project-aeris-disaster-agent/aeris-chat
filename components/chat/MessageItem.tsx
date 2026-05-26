'use client'

import { Message } from '@/types/user'
import { formatTime } from '@/lib/utils/format'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { FollowUpActions, type FollowUpAction } from './FollowUpActions'
import { Headset, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface MessageItemProps {
  message: Message
  selectedColors?: number[][]
  onOpenHotlines?: () => void
  onOpenReportInbox?: () => void
  onStatusUpdate?: (reportId: string | undefined) => void
}

type MessageKind = 'ack' | 'urgent-followup' | 'operator' | 'status-update' | undefined

function readKind(metadata: unknown): MessageKind {
  if (!metadata || typeof metadata !== 'object') return undefined
  const value = (metadata as Record<string, unknown>).kind
  if (
    value === 'ack' ||
    value === 'urgent-followup' ||
    value === 'operator' ||
    value === 'status-update'
  ) {
    return value
  }
  return undefined
}

function readActions(metadata: unknown): FollowUpAction[] {
  if (!metadata || typeof metadata !== 'object') return []
  const raw = (metadata as Record<string, unknown>).actions
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is FollowUpAction =>
      item === 'hotlines' || item === 'verify_phone' || item === 'status_update',
  )
}

function readString(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

export function MessageItem({
  message,
  selectedColors,
  onOpenHotlines,
  onOpenReportInbox,
  onStatusUpdate,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const kind = readKind(message.metadata)

  const getBorderColor = () => {
    if (!selectedColors || selectedColors.length === 0) {
      return undefined
    }
    const [r, g, b] = selectedColors[0]
    return `rgb(${r}, ${g}, ${b})`
  }

  const borderColor = getBorderColor()

  const kindClass =
    kind === 'urgent-followup'
      ? 'border-red-500/70 bg-red-500/10 dark:bg-red-500/10'
      : kind === 'operator'
        ? 'border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/10'
        : kind === 'ack'
          ? 'border-sky-500/60 bg-sky-500/10 dark:bg-sky-500/10'
          : ''

  const baseAssistantClass =
    'bg-white/30 text-black dark:bg-black/30 dark:text-white border-2'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-yellow-400/20 border-2 border-yellow-400 text-black dark:bg-yellow-400/20 dark:border-yellow-400 dark:text-white'
            : kindClass
              ? `${kindClass} text-black dark:text-white border-2`
              : baseAssistantClass
        }`}
        style={!isUser && !kindClass && borderColor ? { borderColor } : undefined}
      >
        {kind === 'operator' && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <Headset className="h-3.5 w-3.5" />
            AERIS Operator
            {readString(message.metadata, 'operatorName') && (
              <span className="font-normal opacity-80">
                · {readString(message.metadata, 'operatorName')}
              </span>
            )}
          </div>
        )}
        {kind === 'urgent-followup' && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
            <ShieldAlert className="h-3.5 w-3.5" />
            Urgent follow-up
          </div>
        )}
        {kind === 'ack' && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Report received
          </div>
        )}

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

        {kind === 'urgent-followup' && (
          <FollowUpActions
            actions={readActions(message.metadata)}
            reportId={readString(message.metadata, 'reportId')}
            reportMessageId={readString(message.metadata, 'reportMessageId')}
            onOpenHotlines={onOpenHotlines}
            onOpenReportInbox={onOpenReportInbox}
            onStatusUpdate={onStatusUpdate}
          />
        )}

        <div className="text-xs mt-2 text-black/70 dark:text-white/70">
          {formatTime(message.created_at)}
        </div>
      </div>
    </div>
  )
}
