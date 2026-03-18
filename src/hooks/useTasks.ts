import { useState, useEffect, useCallback } from 'react'
import type { Task, TodoList } from '../types'

const API = '/api'

export function useTodoLists() {
  const [lists, setLists] = useState<TodoList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/lists`)
      .then(r => r.json())
      .then(setLists)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { lists, loading }
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tasks`)
      const data = await res.json()
      setTasks(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { tasks, loading, refresh: load }
}

export async function createTask(task: {
  title: string
  body?: string
  priority?: string
  claude_type: string
  m365_list_id?: string
  source_email_id?: string
  source_email_subject?: string
  source_email_from?: string
  emailMeta?: any
}): Promise<Task> {
  const res = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  return res.json()
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  return res.json()
}

export async function queueTaskExecution(id: string) {
  const res = await fetch(`${API}/tasks/${id}/queue`, { method: 'POST' })
  return res.json()
}

export async function getTaskResult(id: string) {
  const res = await fetch(`${API}/tasks/${id}/result`)
  return res.json()
}
