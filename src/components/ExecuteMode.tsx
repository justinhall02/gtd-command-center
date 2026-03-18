import { useState, useMemo } from 'react'
import { useTodoLists, useTasks, queueTaskExecution, updateTask } from '../hooks/useTasks'
import ListPicker from './ListPicker'
import TaskCard from './TaskCard'
import type { Task } from '../types'

export default function ExecuteMode() {
  const { lists } = useTodoLists()
  const { tasks, loading, refresh } = useTasks()
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [executionLog, setExecutionLog] = useState<Array<{ time: string; message: string; status: string }>>([])

  const toggleList = (listId: string) => {
    setSelectedLists(prev => {
      const next = new Set(prev)
      if (next.has(listId)) next.delete(listId)
      else next.add(listId)
      return next
    })
  }

  // Filter tasks by selected lists (or show all if none selected)
  const filteredTasks = useMemo(() => {
    if (selectedLists.size === 0) return tasks
    return tasks.filter(t => t.m365_list_id && selectedLists.has(t.m365_list_id))
  }, [tasks, selectedLists])

  const grouped = useMemo(() => ({
    autonomous: filteredTasks.filter(t => t.claude_type === 'autonomous' && t.status !== 'completed'),
    guided: filteredTasks.filter(t => t.claude_type === 'guided' && t.status !== 'completed'),
    manual: filteredTasks.filter(t => t.claude_type === 'manual' && t.status !== 'completed'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  }), [filteredTasks])

  const handleExecute = async (task: Task) => {
    try {
      await queueTaskExecution(task.id)
      setExecutionLog(prev => [{
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        message: `Queued "${task.title}"`,
        status: 'pending',
      }, ...prev])
      refresh()
    } catch (err) {
      console.error(err)
    }
  }

  const handleComplete = async (task: Task) => {
    await updateTask(task.id, { status: 'completed' } as any)
    setExecutionLog(prev => [{
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      message: `Completed "${task.title}"`,
      status: 'done',
    }, ...prev])
    refresh()
  }

  if (loading) {
    return <div className="text-text-dim text-xs">Loading tasks...</div>
  }

  return (
    <div>
      {/* List picker */}
      <div className="mb-6">
        <div className="text-text-dim text-xs mb-2">Pull from lists:</div>
        <ListPicker lists={lists} selected={selectedLists} onToggle={toggleList} />
      </div>

      {/* No tasks */}
      {filteredTasks.length === 0 && (
        <div className="text-text-dim text-xs py-8 text-center border border-border bg-surface">
          No tasks yet. Switch to Process mode to triage emails into tasks.
        </div>
      )}

      {/* Claude Can Do */}
      {grouped.autonomous.length > 0 && (
        <div className="mb-6">
          <div className="text-accent text-xs font-medium tracking-wider mb-2 flex items-center gap-2">
            <span className="text-accent">──</span>
            CLAUDE CAN DO ({grouped.autonomous.length})
            <span className="flex-1 border-t border-border" />
          </div>
          <div className="flex flex-col gap-px bg-border">
            {grouped.autonomous.map(t => (
              <TaskCard key={t.id} task={t} onExecute={() => handleExecute(t)} onComplete={() => handleComplete(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Claude Guided */}
      {grouped.guided.length > 0 && (
        <div className="mb-6">
          <div className="text-warning text-xs font-medium tracking-wider mb-2 flex items-center gap-2">
            <span>──</span>
            CLAUDE GUIDED ({grouped.guided.length})
            <span className="flex-1 border-t border-border" />
          </div>
          <div className="flex flex-col gap-px bg-border">
            {grouped.guided.map(t => (
              <TaskCard key={t.id} task={t} onExecute={() => handleExecute(t)} onComplete={() => handleComplete(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Manual */}
      {grouped.manual.length > 0 && (
        <div className="mb-6">
          <div className="text-text-dim text-xs font-medium tracking-wider mb-2 flex items-center gap-2">
            <span>──</span>
            MANUAL ({grouped.manual.length})
            <span className="flex-1 border-t border-border" />
          </div>
          <div className="flex flex-col gap-px bg-border">
            {grouped.manual.map(t => (
              <TaskCard key={t.id} task={t} onExecute={() => handleExecute(t)} onComplete={() => handleComplete(t)} />
            ))}
          </div>
        </div>
      )}

      {/* Execution log */}
      {executionLog.length > 0 && (
        <div className="mt-8">
          <div className="text-text-dim text-xs font-medium tracking-wider mb-2 flex items-center gap-2">
            <span>──</span>
            EXECUTION LOG
            <span className="flex-1 border-t border-border" />
          </div>
          <div className="border border-border bg-surface">
            {executionLog.map((entry, i) => (
              <div key={i} className="px-4 py-2 text-xs border-b border-border last:border-b-0 flex items-center gap-3">
                <span className="text-text-dim">{entry.time}</span>
                <span className="text-text">{entry.message}</span>
                <span className={entry.status === 'done' ? 'text-success' : 'text-warning'}>
                  {entry.status === 'done' ? '✓' : '...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
