import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { graph } from '../services/graph.js'
import { queueCommand, getResult, listPendingCommands, completeCommand } from '../services/claude.js'
import { recordDecision } from '../services/decisions.js'

const router = Router()

// List local tasks (with optional filters)
router.get('/', (req, res) => {
  try {
    const status = req.query.status as string
    const claudeType = req.query.claude_type as string

    let query = 'SELECT * FROM tasks WHERE 1=1'
    const params: any[] = []

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (claudeType) {
      query += ' AND claude_type = ?'
      params.push(claudeType)
    }

    query += ' ORDER BY created_at DESC'
    const tasks = db.prepare(query).all(...params)
    res.json(tasks)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Create task (writes to M365 To Do + local DB)
router.post('/', async (req, res) => {
  try {
    const { title, body, priority, claude_type, m365_list_id, source_email_id, source_email_subject, source_email_from, emailMeta } = req.body

    // Create in M365 To Do
    let m365Task = null
    if (m365_list_id) {
      m365Task = await graph.createTodoTask(m365_list_id, {
        title,
        body: body || undefined,
        importance: priority === 'urgent' || priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'normal',
      })
    }

    // Create in local DB
    const id = uuid()
    db.prepare(`
      INSERT INTO tasks (id, m365_task_id, m365_list_id, source_email_id, source_email_subject, source_email_from, title, body, priority, claude_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      id,
      m365Task?.id || null,
      m365_list_id || null,
      source_email_id || null,
      source_email_subject || null,
      source_email_from || null,
      title,
      body || null,
      priority || 'normal',
      claude_type || 'manual'
    )

    // Mark email as processed
    if (source_email_id) {
      db.prepare(`
        INSERT OR REPLACE INTO processed_emails (email_id, action, destination)
        VALUES (?, 'added_to_list', ?)
      `).run(source_email_id, title)
    }

    // Record decision for learning
    if (emailMeta) {
      recordDecision('process', emailMeta, `add_task:${claude_type}:${m365_list_id}`)
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    res.json(task)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Update task
router.patch('/:id', (req, res) => {
  try {
    const { status, claude_type, execution_log } = req.body
    const updates: string[] = []
    const params: any[] = []

    if (status) {
      updates.push('status = ?')
      params.push(status)
      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP')
      }
    }
    if (claude_type) {
      updates.push('claude_type = ?')
      params.push(claude_type)
    }
    if (execution_log) {
      updates.push('execution_log = ?')
      params.push(JSON.stringify(execution_log))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    params.push(req.params.id)
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
    res.json(task)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Queue task for Claude execution
router.post('/:id/queue', async (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any
    if (!task) return res.status(404).json({ error: 'Task not found' })

    // Get source email body if available
    let sourceEmail = undefined
    if (task.source_email_id) {
      try {
        const msg = await graph.getMessage(task.source_email_id)
        sourceEmail = {
          from: msg.from?.emailAddress?.address || task.source_email_from,
          subject: msg.subject || task.source_email_subject,
          body: msg.body?.content || '',
        }
      } catch {
        // Email may have been moved/deleted
      }
    }

    const cmd = queueCommand({
      taskId: task.id,
      type: task.claude_type === 'autonomous' ? 'autonomous' : 'guided',
      title: task.title,
      context: task.body || '',
      sourceEmail,
    })

    // Update task status
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('in_progress', task.id)

    res.json({ command: cmd })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get execution result
router.get('/:id/result', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any
    if (!task) return res.status(404).json({ error: 'Task not found' })

    // Find the command for this task
    const pending = listPendingCommands().find(c => c.taskId === task.id)
    if (pending) {
      const result = getResult(pending.id)
      return res.json({ status: result ? 'completed' : 'pending', result, command: pending })
    }

    res.json({ status: task.status, executionLog: task.execution_log ? JSON.parse(task.execution_log) : null })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Delete/dismiss a task and its pending command
router.delete('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any
    if (!task) return res.status(404).json({ error: 'Task not found' })

    // Remove any pending command for this task
    const pending = listPendingCommands().find(c => c.taskId === task.id)
    if (pending) {
      completeCommand(pending.id, {
        commandId: pending.id,
        taskId: task.id,
        status: 'error',
        summary: 'Dismissed by user',
        actions: [],
      })
    }

    // Delete from local DB
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)

    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
