import { Router } from 'express'
import fs from 'fs'
import { listPendingCommands, getResult, isSessionActive, launchSession } from '../services/claude.js'
import { getPatterns, getFolderUsageRanking, getMisroutePatterns } from '../services/decisions.js'
import db from '../db.js'

const router = Router()

// List pending commands (for Claude Code to pick up)
router.get('/pending', (_req, res) => {
  try {
    const commands = listPendingCommands()
    res.json(commands)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get result for a command
router.get('/result/:commandId', (req, res) => {
  try {
    const result = getResult(req.params.commandId)
    res.json(result || { status: 'pending' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get learned patterns
router.get('/patterns', (_req, res) => {
  try {
    const patterns = getPatterns()
    res.json(patterns)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get folder usage ranking (for sorting misroute/move menus)
router.get('/folder-ranking', (_req, res) => {
  try {
    const ranking = getFolderUsageRanking()
    res.json(ranking)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get misroute patterns (for rule suggestions)
router.get('/misroute-patterns', (_req, res) => {
  try {
    const patterns = getMisroutePatterns()
    res.json(patterns)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Check if a Claude session is currently running
router.get('/session', (_req, res) => {
  res.json({ active: isSessionActive() })
})

// Launch a Claude Code session with all pending tasks
router.post('/session/start', (_req, res) => {
  try {
    if (isSessionActive()) {
      return res.status(409).json({ error: 'A session is already running' })
    }

    // Get all pending/in_progress tasks
    const tasks = db.prepare(`
      SELECT id, title, claude_type, body, source_email_from, source_email_subject, claude_action
      FROM tasks
      WHERE status IN ('pending', 'in_progress')
      ORDER BY created_at ASC
    `).all() as any[]

    if (tasks.length === 0) {
      return res.status(400).json({ error: 'No pending tasks to execute' })
    }

    const result = launchSession(tasks)
    res.json({ ok: true, taskCount: tasks.length, promptFile: result.promptFile })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Stop/reset the session (clears lock, resets in_progress tasks to pending)
router.post('/session/stop', (_req, res) => {
  try {
    const lockFile = '/tmp/gtd-session-active.lock'
    try { fs.unlinkSync(lockFile) } catch {}

    const result = db.prepare("UPDATE tasks SET status = 'pending' WHERE status = 'in_progress'").run()
    console.log(`[SESSION] Stopped — ${result.changes} tasks reset to pending`)

    res.json({ ok: true, tasksReset: result.changes })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
