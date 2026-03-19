import { useState, useMemo } from 'react'
import type { TodoList, EmailMessage } from '../types'
import { createTask } from '../hooks/useTasks'

interface Props {
  email: EmailMessage
  lists: TodoList[]
  onSaved: () => void
  onCancel: () => void
}

// Analyze email to suggest whether Claude can help
function analyzeEmail(email: EmailMessage): { type: 'autonomous' | 'guided' | 'manual'; reason: string } {
  const subject = (email.subject || '').toLowerCase()
  const from = email.from.emailAddress.address.toLowerCase()
  const preview = (email.bodyPreview || '').toLowerCase()
  const all = `${subject} ${preview}`

  // Things Claude can definitely do autonomously
  if (/quote|pricing|proposal|estimate|bid/.test(all) && /cat6|cabling|install|network|low voltage|fiber/.test(all)) {
    return { type: 'autonomous', reason: 'Looks like a quote request — Claude can draft via /create-quote' }
  }
  if (/follow.?up|check.?in|touching base|circling back/.test(all)) {
    return { type: 'autonomous', reason: 'Follow-up email — Claude can draft a reply' }
  }
  if (/schedule|calendar|meeting|appointment|availability/.test(all)) {
    return { type: 'autonomous', reason: 'Scheduling — Claude can check calendar and reply' }
  }
  if (/invoice|payment|billing|receipt|paid/.test(all)) {
    return { type: 'guided', reason: 'Billing/invoice — Claude can help review but you should verify amounts' }
  }
  if (/hubspot|crm|deal|pipeline|contact/.test(all)) {
    return { type: 'autonomous', reason: 'CRM task — Claude has HubSpot access' }
  }
  if (/wordpress|website|seo|plugin|css|page/.test(all)) {
    return { type: 'autonomous', reason: 'Web/SEO task — Claude can make the changes' }
  }
  if (/review|approve|sign|contract|agreement|legal/.test(all)) {
    return { type: 'guided', reason: 'Needs your review — Claude can prep but you decide' }
  }

  // Things Claude can guide you through
  if (/call|phone|visit|in.?person|on.?site|walk.?through/.test(all)) {
    return { type: 'manual', reason: 'Requires physical presence or a phone call' }
  }
  if (/password|login|credential|2fa|mfa/.test(all)) {
    return { type: 'manual', reason: 'Security/credentials — you need to handle this directly' }
  }

  // Default: Claude can probably help somehow
  return { type: 'guided', reason: 'Claude can help research and draft — review before sending' }
}

export default function TaskForm({ email, lists, onSaved, onCancel }: Props) {
  const analysis = useMemo(() => analyzeEmail(email), [email])

  // Default to "Tasks" list
  const defaultListId = useMemo(() => {
    const tasksList = lists.find(l => l.displayName === 'Tasks')
    return tasksList?.id || ''
  }, [lists])

  const [title, setTitle] = useState(email.subject || '')
  const [selectedList, setSelectedList] = useState(defaultListId)
  const [claudeType, setClaudeType] = useState<'autonomous' | 'guided' | 'manual'>(analysis.type)
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

      {/* Claude's suggestion */}
      <div className="mb-3 px-3 py-2 border border-accent/20 bg-bg text-xs">
        <span className="text-accent">Claude thinks:</span>{' '}
        <span className="text-text-dim">{analysis.reason}</span>
      </div>

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
                  ? value === 'autonomous' ? 'bg-accent text-bg' : value === 'guided' ? 'bg-warning text-bg' : 'bg-text-dim text-bg'
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
