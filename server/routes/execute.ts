import { Router } from 'express'
import { listPendingCommands, getResult } from '../services/claude.js'
import { getPatterns, getFolderUsageRanking, getMisroutePatterns } from '../services/decisions.js'

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

export default router
