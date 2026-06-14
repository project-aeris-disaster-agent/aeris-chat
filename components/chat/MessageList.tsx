'use client'

import { Message } from '@/types/user'
import { MessageItem } from './MessageItem'
import { IncidentDraftCard, type IncidentDraftCardStatus } from './IncidentDraftCard'
import type { DraftIncidentReport } from '@/lib/incidents/intent'

export type DraftEntry = {
  draft: DraftIncidentReport
  status: IncidentDraftCardStatus
  draftId?: string
  missingSlots?: string[]
  nextQuestion?: string | null
}

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  selectedColors?: number[][]
  sessionId?: string | null
  /** Draft proposals keyed by the user-message id that triggered them. */
  draftsByUserMessageId?: Record<string, DraftEntry>
  onDraftStatusChange?: (userMessageId: string, status: IncidentDraftCardStatus) => void
  onDraftRefine?: (draftId: string, answer: string) => Promise<void> | void
  onOpenHotlines?: () => void
  onOpenReportInbox?: () => void
  onStatusUpdate?: (reportId: string | undefined) => void
  onOpenForecast?: () => void
}

export function MessageList({
  messages,
  isLoading,
  selectedColors,
  sessionId,
  draftsByUserMessageId,
  onDraftStatusChange,
  onDraftRefine,
  onOpenHotlines,
  onOpenReportInbox,
  onStatusUpdate,
  onOpenForecast,
}: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {messages.map((message) => {
        const entry =
          message.role === 'user' && draftsByUserMessageId
            ? draftsByUserMessageId[message.id]
            : undefined
        return (
          <div key={message.id}>
            <MessageItem
              message={message}
              selectedColors={selectedColors}
              onOpenHotlines={onOpenHotlines}
              onOpenReportInbox={onOpenReportInbox}
              onStatusUpdate={onStatusUpdate}
              onOpenForecast={onOpenForecast}
            />
            {entry && (
              <div className="flex justify-start">
                <IncidentDraftCard
                  draft={entry.draft}
                  sessionId={sessionId ?? null}
                  initialStatus={entry.status}
                  onStatusChange={(status) => onDraftStatusChange?.(message.id, status)}
                  draftId={entry.draftId}
                  missingSlots={entry.missingSlots}
                  nextQuestion={entry.nextQuestion}
                  onRefine={onDraftRefine}
                />
              </div>
            )}
          </div>
        )
      })}
      {isLoading && (
        <div className="flex items-center gap-2 text-text-secondary">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-secondary border-t-transparent"></div>
          <span>AI is thinking...</span>
        </div>
      )}
    </div>
  )
}

