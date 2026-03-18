import { useState } from 'react'
import type { TodoList, EmailMessage } from '../types'
import { createTask } from '../hooks/useTasks'

interface Props {
  email: EmailMessage
  lists: TodoList[]
  onSaved: () => void
  onCancel: () => void
}

export default function TaskForm({ email, lists, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(email.subject || '')
  const [selectedList, setSelectedList] = useState('')
  const [claudeType, setClaudeType] = useState<'autonomous' | 'guided' | 'manual'>('autonomous')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await createTask({
        title,
        body: email.bodyPreview,
        claude_type: claudeType,
        m365_list_id: selectedList || undefined,
        source_email_id: email.id,
        source_email_subject: email.subject,
        source_email_from: email.from.emailAddress.address,
        emailMeta: {
          from: email.from.emailAddress.address,
          subject: email.subject,
          hasAttachments: email.hasAttachments,
        },
      })
      onSaved()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-accent/30 bg-surface-hover px-4 py-3 mt-2">
      <div className="text-accent text-xs font-medium mb-3 tracking-wider">ADD TASK</div>

      {/* List picker */}
      <div className="mb-3">
        <label className="text-text-dim text-xs block mb-1">List:</label>
        <select
          value={selectedList}
          onChange={e => setSelectedList(e.target.value)}
          className="w-full bg-surface border border-border text-text text-xs px-3 py-1.5 focus:outline-none focus:border-accent"
        >
          <option value="">No M365 list (local only)</option>
          {lists.map(l => (
            <option key={l.id} value={l.id}>{l.displayName}</option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className="mb-3">
        <label className="text-text-dim text-xs block mb-1">Title:</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-surface border border-border text-text text-xs px-3 py-1.5 focus:outline-none focus:border-accent"
          autoFocus
        />
      </div>

      {/* Claude type */}
      <div className="mb-4">
        <label className="text-text-dim text-xs block mb-2">Type:</label>
        <div className="flex gap-3">
          {([
            ['autonomous', 'CLAUDE DO'],
            ['guided', 'GUIDED'],
            ['manual', 'MANUAL'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setClaudeType(value)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                claudeType === value
                  ? 'bg-accent text-bg'
                  : 'border border-border text-text-dim hover:text-text'
              }`}
            >
              {claudeType === value ? '●' : '○'} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-dim hover:text-text transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="px-4 py-1.5 text-xs font-medium bg-accent text-bg hover:bg-accent-dim disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save & Next →'}
        </button>
      </div>
    </div>
  )
}
