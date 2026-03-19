import type { Task } from '../types'

interface Props {
  task: Task
  onExecute: () => void
  onComplete: () => void
  onDismiss: () => void
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

export default function TaskCard({ task, onExecute, onComplete, onDismiss }: Props) {
  const isRunning = task.status === 'in_progress'
  const isDone = task.status === 'completed'

  return (
    <div className={`border border-border px-4 py-3 flex items-center justify-between transition-colors ${
      isDone ? 'opacity-50' : 'hover:bg-surface-hover'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isDone ? 'line-through text-text-dim' : 'text-text'}`}>
            {isDone ? '✓' : '○'} {task.title}
          </span>
          {isRunning && (
            <span className="text-warning text-xs animate-pulse">executing...</span>
          )}
        </div>
        {task.source_email_from && (
          <div className="text-text-dim text-xs mt-0.5 pl-4">
            via: {task.source_email_from} · {timeAgo(task.created_at)}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 ml-3 flex gap-2">
        {!isDone && (
          <button
            onClick={onDismiss}
            className="px-2 py-1 text-xs text-text-dim hover:text-danger transition-colors"
            title="Dismiss task"
          >
            ✕
          </button>
        )}
        {task.claude_type === 'autonomous' && !isDone && (
          <button
            onClick={onExecute}
            disabled={isRunning}
            className="px-3 py-1 text-xs font-medium bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 transition-colors"
          >
            {isRunning ? '...' : '▸ EXECUTE'}
          </button>
        )}
        {task.claude_type === 'guided' && !isDone && (
          <button
            onClick={onExecute}
            disabled={isRunning}
            className="px-3 py-1 text-xs font-medium border border-accent text-accent hover:bg-accent hover:text-bg disabled:opacity-50 transition-colors"
          >
            {isRunning ? '...' : '▸ START'}
          </button>
        )}
        {task.claude_type === 'manual' && !isDone && (
          <button
            onClick={onComplete}
            className="px-3 py-1 text-xs font-medium border border-border text-text-dim hover:text-success hover:border-success transition-colors"
          >
            ✓ DONE
          </button>
        )}
      </div>
    </div>
  )
}
