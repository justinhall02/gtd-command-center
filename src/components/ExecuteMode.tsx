import { useState, useMemo, useEffect } from 'react'
import { useTodoLists, useTasks, updateTask, deleteTask } from '../hooks/useTasks'
import ListPicker from './ListPicker'
import TaskKanbanCard from './TaskKanbanCard'
import type { Task } from '../types'

export default function ExecuteMode() {
  const { lists } = useTodoLists()
  const { tasks, loading, refresh } = useTasks()
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [sessionActive, setSessionActive] = useState(false)
  const [launching, setLaunching] = useState(false)

  // Poll session status
  useEffect(() => {
    const check = () => {
      fetch('/api/execute/session').then(r => r.json()).then(d => setSessionActive(d.active)).catch(() => {})
    }
    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh tasks every 3s to catch completions from Claude session
  useEffect(() => {
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const toggleList = (listId: string) => {
    setSelectedLists(prev => {
      const next = new Set(prev)
      if (next.has(listId)) next.delete(listId)
      else next.add(listId)
      return next
    })
  }

  const filteredTasks = useMemo(() => {
    if (selectedLists.size === 0) return tasks
    return tasks.filter(t => !t.m365_list_id || selectedLists.has(t.m365_list_id))
  }, [tasks, selectedLists])

  const columns = useMemo(() => ({
    pending: filteredTasks.filter(t => t.status === 'pending'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    done: filteredTasks.filter(t => t.status === 'completed').slice(0, 10),
  }), [filteredTasks])

  const handleStartSession = async () => {
    setLaunching(true)
    try {
      const res = await fetch('/api/execute/session/start', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setSessionActive(true)
        refresh()
      } else {
        alert(data.error || 'Failed to start session')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLaunching(false)
    }
  }

  const handleStopSession = async () => {
    try {
      await fetch('/api/execute/session/stop', { method: 'POST' })
      setSessionActive(false)
      refresh()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDismiss = async (task: Task) => {
    await deleteTask(task.id)
    refresh()
  }

  const handleComplete = async (task: Task) => {
    await updateTask(task.id, { status: 'completed' } as any)
    refresh()
  }

  if (loading) {
    return <div className="text-text-dim text-xs">Loading tasks...</div>
  }

  return (
    <div>
      {/* List picker + Start Session */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="text-text-dim text-xs mb-2">Pull from lists:</div>
          <ListPicker lists={lists} selected={selectedLists} onToggle={toggleList} />
        </div>
        <button
          onClick={handleStartSession}
          disabled={launching || sessionActive || columns.pending.length === 0}
          className={`px-6 py-3 text-sm font-bold tracking-wider transition-colors flex-shrink-0 ${
            sessionActive
              ? 'bg-warning/20 text-warning border border-warning/40 cursor-not-allowed'
              : launching
              ? 'bg-accent/50 text-bg cursor-wait'
              : columns.pending.length === 0
              ? 'bg-surface text-text-dim border border-border cursor-not-allowed'
              : 'bg-accent text-bg hover:bg-accent-dim'
          }`}
        >
          {sessionActive ? 'SESSION RUNNING...' : launching ? 'LAUNCHING...' : `START SESSION (${columns.pending.length})`}
        </button>
      </div>

      {/* Session active banner */}
      {sessionActive && (
        <div className="mb-4 px-4 py-2 border border-warning/40 bg-warning/5 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-warning animate-pulse">●</span>
            <span className="text-text">Claude is working in Windows Terminal — switch to it to interact</span>
          </div>
          <button
            onClick={handleStopSession}
            className="px-3 py-1 text-xs font-medium border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
          >
            Stop Session
          </button>
        </div>
      )}

      {/* No tasks */}
      {filteredTasks.length === 0 && (
        <div className="text-text-dim text-xs py-8 text-center border border-border bg-surface">
          No tasks yet. Switch to Inbox to triage emails into tasks.
        </div>
      )}

      {/* Kanban board */}
      {filteredTasks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {/* PENDING column */}
          <div>
            <div className="text-text-dim text-xs font-medium tracking-wider mb-3 flex items-center gap-2 pb-2 border-b border-border">
              PENDING
              <span className="text-accent">({columns.pending.length})</span>
            </div>
            {columns.pending.length === 0 && (
              <div className="text-text-dim text-xs py-4 text-center opacity-50">No pending tasks</div>
            )}
            {columns.pending.map(t => (
              <TaskKanbanCard
                key={t.id}
                task={t}
                column="pending"
                onDismiss={() => handleDismiss(t)}
              />
            ))}
          </div>

          {/* IN PROGRESS column */}
          <div>
            <div className="text-accent text-xs font-medium tracking-wider mb-3 flex items-center gap-2 pb-2 border-b border-accent/30">
              IN PROGRESS
              <span>({columns.in_progress.length})</span>
            </div>
            {columns.in_progress.length === 0 && (
              <div className="text-text-dim text-xs py-4 text-center opacity-50">Nothing running</div>
            )}
            {columns.in_progress.map(t => (
              <TaskKanbanCard
                key={t.id}
                task={t}
                column="in_progress"
                onComplete={() => handleComplete(t)}
              />
            ))}
          </div>

          {/* DONE column */}
          <div>
            <div className="text-success text-xs font-medium tracking-wider mb-3 flex items-center gap-2 pb-2 border-b border-success/30">
              DONE
              <span>({columns.done.length})</span>
            </div>
            {columns.done.length === 0 && (
              <div className="text-text-dim text-xs py-4 text-center opacity-50">Nothing done yet</div>
            )}
            {columns.done.map(t => (
              <TaskKanbanCard
                key={t.id}
                task={t}
                column="done"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
