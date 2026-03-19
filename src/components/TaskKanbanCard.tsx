import type { Task } from '../types'

interface Props {
  task: Task
  column: 'pending' | 'in_progress' | 'done'
  onDismiss?: () => void
  onComplete?: () => void
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

const typeBadge = {
  autonomous: { label: 'AUTO', cls: 'text-accent border-accent/30' },
  guided: { label: 'GUIDED', cls: 'text-warning border-warning/30' },
  manual: { label: 'MANUAL', cls: 'text-text-dim border-border' },
}

export default function TaskKanbanCard({ task, column, onDismiss, onComplete }: Props) {
  const badge = typeBadge[task.claude_type] || typeBadge.manual

  return (
    <div className={`border border-border bg-surface px-3 py-2.5 mb-2 transition-colors ${
      column === 'in_progress' ? 'border-accent/40 bg-accent/5' : ''
    } ${column === 'done' ? 'opacity-60' : 'hover:bg-surface-hover'}`}>
      {/* Title + badge */}
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium ${column === 'done' ? 'line-through text-text-dim' : 'text-text'}`}>
          {column === 'done' ? '✓ ' : column === 'in_progress' ? '▸ ' : '○ '}
          {task.title.length > 45 ? task.title.slice(0, 45) + '...' : task.title}
        </span>
        <span className={`text-xs border px-1.5 py-0.5 flex-shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Meta */}
      {task.source_email_from && (
        <div className="text-text-dim text-xs mt-1 pl-3">
          {task.source_email_from}
        </div>
      )}

      {/* Status-specific content */}
      {column === 'in_progress' && (
        <div className="mt-1.5 pl-3">
          <span className="text-accent text-xs animate-pulse">executing...</span>
        </div>
      )}

      {column === 'done' && task.completed_at && (
        <div className="mt-1 pl-3">
          <span className="text-text-dim text-xs">{timeAgo(task.completed_at)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-2 pl-3">
        {column === 'pending' && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-text-dim hover:text-danger transition-colors"
          >
            ✕ dismiss
          </button>
        )}
        {column === 'in_progress' && onComplete && (
          <button
            onClick={onComplete}
            className="text-xs text-text-dim hover:text-success transition-colors"
          >
            ✓ mark done
          </button>
        )}
      </div>
    </div>
  )
}
