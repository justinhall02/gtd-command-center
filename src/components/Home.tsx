import { useEffect, useState } from 'react'
import type { AppMode } from '../App'

interface FolderSummary {
  id: string
  displayName: string
  unreadItemCount: number
  totalItemCount: number
}

interface Props {
  onNavigate: (mode: AppMode) => void
  onOpenFolder: (folderId: string) => void
}

export default function Home({ onNavigate, onOpenFolder }: Props) {
  const [folders, setFolders] = useState<FolderSummary[]>([])
  const [childFolders, setChildFolders] = useState<FolderSummary[]>([])
  const [taskCount, setTaskCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/folders').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
    ]).then(([foldersData, tasksData]) => {
      setFolders(foldersData)
      setTaskCount(tasksData.filter((t: any) => t.status !== 'completed').length)

      const inbox = foldersData.find((f: any) => f.displayName === 'Inbox')
      if (inbox) {
        fetch(`/api/folders/${inbox.id}/children`).then(r => r.json()).then(setChildFolders)
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const inbox = folders.find(f => f.displayName === 'Inbox')
  const gtdFolders = childFolders.filter(f =>
    /^[0-9]:/.test(f.displayName) || f.displayName.startsWith('Quote Now')
  )

  if (loading) {
    return <div className="text-text-dim text-xs">Loading dashboard...</div>
  }

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-accent text-lg font-semibold tracking-wider mb-1">DASHBOARD</h1>
        <p className="text-text-dim text-xs">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => inbox && onOpenFolder(inbox.id)}
          className="border border-border bg-surface px-4 py-4 text-left hover:border-accent transition-colors"
        >
          <div className="text-accent text-2xl font-bold">{inbox?.unreadItemCount || 0}</div>
          <div className="text-text-dim text-xs mt-1">Inbox Unread</div>
        </button>
        <button
          onClick={() => {
            const today = gtdFolders.find(f => f.displayName === '3: Today')
            if (today) onOpenFolder(today.id)
          }}
          className="border border-border bg-surface px-4 py-4 text-left hover:border-warning transition-colors"
        >
          <div className="text-warning text-2xl font-bold">
            {gtdFolders.find(f => f.displayName === '3: Today')?.totalItemCount || 0}
          </div>
          <div className="text-text-dim text-xs mt-1">Today (Now)</div>
        </button>
        <button
          onClick={() => onNavigate('execute')}
          className="border border-border bg-surface px-4 py-4 text-left hover:border-success transition-colors"
        >
          <div className="text-success text-2xl font-bold">{taskCount}</div>
          <div className="text-text-dim text-xs mt-1">Active Tasks</div>
        </button>
      </div>

      {/* GTD Folders overview — clickable */}
      <div className="mb-8">
        <div className="text-text-dim text-xs font-medium tracking-wider mb-3 flex items-center gap-2">
          <span>──</span> MAIL FOLDERS <span className="flex-1 border-t border-border" />
        </div>
        <div className="flex flex-col gap-px bg-border">
          {gtdFolders.map(f => (
            <button
              key={f.id}
              onClick={() => onOpenFolder(f.id)}
              className="bg-surface px-4 py-2 flex items-center justify-between hover:bg-surface-hover transition-colors text-left w-full"
            >
              <span className="text-text text-xs hover:text-accent transition-colors">{f.displayName}</span>
              <div className="flex items-center gap-3">
                {f.unreadItemCount > 0 && (
                  <span className="text-accent text-xs">{f.unreadItemCount} unread</span>
                )}
                <span className="text-text-dim text-xs">{f.totalItemCount}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => inbox && onOpenFolder(inbox.id)}
          className="flex-1 px-4 py-3 bg-accent text-bg text-xs font-medium tracking-wider hover:bg-accent-dim transition-colors"
        >
          START PROCESSING INBOX
        </button>
        <button
          onClick={() => onNavigate('execute')}
          className="flex-1 px-4 py-3 border border-accent text-accent text-xs font-medium tracking-wider hover:bg-accent hover:text-bg transition-colors"
        >
          EXECUTE TASKS
        </button>
      </div>
    </div>
  )
}
