import { useState, useRef, useEffect } from 'react'
import type { EmailMessage, Suggestion } from '../types'
import { useFullMessage } from '../hooks/useEmails'

interface Props {
  email: EmailMessage
  suggestion: Suggestion | null
  index: number
  total: number
  onAddTask: () => void
  onMove: () => void
  onMisrouted: () => void
  onReportSpam: () => void
  onReportPhishing: () => void
  onQuoteIt: () => void
  onArchive: () => void
  onSkip: () => void
  isQuoteEmail: boolean
}

// Strip color/background styles from email HTML but KEEP layout styles (padding, margin, etc.)
function sanitizeEmailHtml(html: string): string {
  // Remove <style> blocks (class-based CSS with colors/backgrounds)
  let cleaned = html.replace(/<style[\s\S]*?<\/style>/gi, '')

  // Remove legacy HTML color attributes
  cleaned = cleaned.replace(/\sbgcolor="[^"]*"/gi, '')
  cleaned = cleaned.replace(/\scolor="[^"]*"/gi, '')

  // For inline style="..." — strip only color/background properties, keep layout
  cleaned = cleaned.replace(/\sstyle="([^"]*)"/gi, (_match, styleContent: string) => {
    // Remove color and background properties but keep everything else
    const cleaned_props = styleContent
      .split(';')
      .map((prop: string) => prop.trim())
      .filter((prop: string) => {
        if (!prop) return false
        const lower = prop.toLowerCase()
        // Strip these — they fight our dark theme
        if (lower.startsWith('color')) return false
        if (lower.startsWith('background-color')) return false
        if (lower.startsWith('background')) return false
        // Keep everything else — padding, margin, font-size, width, border-radius, etc.
        return true
      })
      .join('; ')

    return cleaned_props ? ` style="${cleaned_props}"` : ''
  })

  return cleaned
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

export default function EmailCard({ email, suggestion, index, total, onAddTask, onMove, onMisrouted, onReportSpam, onReportPhishing, onQuoteIt, onArchive, onSkip, isQuoteEmail }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { message: fullMessage } = useFullMessage(expanded ? email.id : null)
  const emailBodyRef = useRef<HTMLDivElement>(null)

  // Force all links in email body to open in new window
  useEffect(() => {
    if (!emailBodyRef.current) return
    const links = emailBodyRef.current.querySelectorAll('a')
    links.forEach(link => {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    })
  }, [fullMessage])

  return (
    <div className="border border-border bg-surface">
      {/* Header — always visible, with reply + minimize buttons */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-text-dim text-xs">
          Email {index + 1} of {total}
        </span>
        <div className="flex items-center gap-3">
          {email.hasAttachments && (
            <span className="text-warning text-xs">+ attachments</span>
          )}
          {fullMessage?.webLink && (
            <a
              href={fullMessage.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-xs hover:text-accent-dim transition-colors"
            >
              Open in Outlook
            </a>
          )}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="text-accent text-xs hover:text-accent-dim transition-colors"
            >
              ▴ minimize
            </button>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="px-4 py-4">
        {/* Summary — always visible */}
        <div className="flex items-start justify-between mb-1">
          <span className="text-accent text-xs">{email.from.emailAddress.address}</span>
          <span className="text-text-dim text-xs">{timeAgo(email.receivedDateTime)}</span>
        </div>
        <h3 className="text-text font-medium text-sm mb-2">{email.subject}</h3>
        <p className="text-text/70 text-xs leading-relaxed">
          {email.bodyPreview}
        </p>

        {/* Expanded email body — fills available viewport height, scrollable */}
        {expanded && fullMessage?.body && (
          <div
            ref={emailBodyRef}
            className="mt-3 pt-3 border-t border-border text-sm leading-relaxed overflow-y-auto email-body-override"
            style={{ maxHeight: 'calc(100vh - 380px)' }}
            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(fullMessage.body.content) }}
          />
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-accent-dim text-xs mt-2 hover:text-accent transition-colors"
        >
          {expanded ? '▾ collapse' : '▸ show full email'}
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
      <div className="px-4 py-3 border-t border-border flex gap-2 flex-wrap">
        {isQuoteEmail && (
          <button
            onClick={onQuoteIt}
            className="px-3 py-1.5 text-xs font-bold bg-success text-bg hover:opacity-80 transition-colors animate-pulse"
          >
            [Q] Quote It
          </button>
        )}
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
          onClick={onMisrouted}
          className="px-3 py-1.5 text-xs font-medium border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
        >
          [R] Misrouted
        </button>
        <button
          onClick={onReportSpam}
          className="px-3 py-1.5 text-xs font-medium border border-warning/40 text-warning hover:bg-warning/10 transition-colors"
        >
          [S] Spam
        </button>
        <button
          onClick={onReportPhishing}
          className="px-3 py-1.5 text-xs font-medium border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
        >
          [P] Phishing
        </button>
        <button
          onClick={onArchive}
          className="px-3 py-1.5 text-xs font-medium border border-border text-text-dim hover:bg-danger/20 hover:text-danger hover:border-danger/40 transition-colors"
        >
          [D] Delete
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
