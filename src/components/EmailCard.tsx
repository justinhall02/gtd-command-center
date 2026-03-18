import { useState } from 'react'
import type { EmailMessage, Suggestion } from '../types'
import { useFullMessage } from '../hooks/useEmails'

interface Props {
  email: EmailMessage
  suggestion: Suggestion | null
  index: number
  total: number
  onAddTask: () => void
  onMove: () => void
  onArchive: () => void
  onSkip: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function EmailCard({ email, suggestion, index, total, onAddTask, onMove, onArchive, onSkip }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { message: fullMessage } = useFullMessage(expanded ? email.id : null)

  return (
    <div className="border border-border bg-surface">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-text-dim text-xs">
          Email {index + 1} of {total}
        </span>
        {email.hasAttachments && (
          <span className="text-warning text-xs">+ attachments</span>
        )}
      </div>

      {/* Email content */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between mb-1">
          <span className="text-accent text-xs">{email.from.emailAddress.address}</span>
          <span className="text-text-dim text-xs">{timeAgo(email.receivedDateTime)}</span>
        </div>
        <h3 className="text-text font-medium text-sm mb-2">{email.subject}</h3>
        <p className="text-text-dim text-xs leading-relaxed">
          {email.bodyPreview}
        </p>

        {/* Expanded full email */}
        {expanded && fullMessage?.body && (
          <div
            className="mt-3 pt-3 border-t border-border text-xs text-text-dim leading-relaxed max-h-64 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: fullMessage.body.content }}
          />
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-accent-dim text-xs mt-2 hover:text-accent transition-colors"
        >
          {expanded ? '▾ hide full email' : '▸ show full email'}
        </button>
      </div>

      {/* Suggestion badge */}
      {suggestion && (
        <div className="px-4 py-2 border-t border-border bg-surface-hover">
          <span className="text-success text-xs">
            Suggesting: {suggestion.action} ({suggestion.confidence}% · {suggestion.matchCount} matches)
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <button
          onClick={onAddTask}
          className="px-3 py-1.5 text-xs font-medium bg-accent text-bg hover:bg-accent-dim transition-colors"
        >
          [T] Add Task
        </button>
        <button
          onClick={onMove}
          className="px-3 py-1.5 text-xs font-medium border border-border text-text hover:bg-surface-hover transition-colors"
        >
          [M] Move To
        </button>
        <button
          onClick={onArchive}
          className="px-3 py-1.5 text-xs font-medium border border-border text-text-dim hover:bg-surface-hover transition-colors"
        >
          [A] Archive
        </button>
        <button
          onClick={onSkip}
          className="ml-auto px-3 py-1.5 text-xs font-medium text-text-dim hover:text-text transition-colors"
        >
          Skip →
        </button>
      </div>
    </div>
  )
}
