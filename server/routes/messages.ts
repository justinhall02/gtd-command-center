import { Router } from 'express'
import { graph } from '../services/graph.js'
import db from '../db.js'
import { recordDecision, getSuggestion } from '../services/decisions.js'

const router = Router()

// Get full message
router.get('/:id', async (req, res) => {
  try {
    const message = await graph.getMessage(req.params.id)
    // Also check for suggestions based on this email
    const suggestion = getSuggestion({
      from: message.from?.emailAddress?.address,
      subject: message.subject,
      hasAttachments: message.hasAttachments,
    })
    res.json({ message, suggestion })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Move message to folder
router.post('/:id/move', async (req, res) => {
  try {
    const { destinationFolderId, folderName } = req.body
    const result = await graph.moveMessage(req.params.id, destinationFolderId)

    // Record as processed
    db.prepare(`
      INSERT OR REPLACE INTO processed_emails (email_id, action, destination)
      VALUES (?, 'moved', ?)
    `).run(req.params.id, folderName || destinationFolderId)

    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Mark as processed (archive, skip, etc.)
router.post('/:id/process', async (req, res) => {
  try {
    const { action, destination, emailMeta } = req.body

    if (action === 'archive') {
      const folders = await graph.listFolders()
      const archive = folders.find((f: any) => f.displayName === 'Archive')
      if (archive) {
        await graph.moveMessage(req.params.id, archive.id)
      }
    }

    if (action === 'delete') {
      const folders = await graph.listFolders()
      const trash = folders.find((f: any) => f.displayName === 'Deleted Items')
      if (trash) {
        await graph.moveMessage(req.params.id, trash.id)
      }
    }

    db.prepare(`
      INSERT OR REPLACE INTO processed_emails (email_id, action, destination)
      VALUES (?, ?, ?)
    `).run(req.params.id, action, destination || null)

    // Record decision for learning — misroutes are corrections
    if (emailMeta) {
      const isMisroute = action === 'misrouted'
      recordDecision(
        'process',
        emailMeta,
        `${action}:${destination || 'none'}`,
        isMisroute ? `routed_to:${emailMeta.folder}` : undefined,  // what the rules suggested (wrong folder)
        undefined,
        isMisroute ? `Was in ${emailMeta.folder}, should be in ${emailMeta.correctedTo}` : undefined
      )
    }

    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Report to Coro (forward email as phishing/spam report)
const CORO_REPORT_ADDRESS = process.env.CORO_REPORT_ADDRESS || 'report@coro.net'

router.post('/:id/report-coro', async (req, res) => {
  try {
    const { action: reportAction, emailMeta } = req.body
    const comment = `Reported as ${reportAction || 'suspicious'} via GTD Command Center`

    // Forward email to Coro for analysis
    await graph.forwardMessage(req.params.id, CORO_REPORT_ADDRESS, comment)

    // Move to Deleted Items after reporting
    const folders = await graph.listFolders()
    const trash = folders.find((f: any) => f.displayName === 'Deleted Items')
    if (trash) {
      await graph.moveMessage(req.params.id, trash.id)
    }

    // Record in processed emails
    db.prepare(`
      INSERT OR REPLACE INTO processed_emails (email_id, action, destination)
      VALUES (?, 'reported_coro', ?)
    `).run(req.params.id, CORO_REPORT_ADDRESS)

    // Record decision for learning
    if (emailMeta) {
      recordDecision('process', emailMeta, `report_coro:${reportAction || 'suspicious'}`)
    }

    res.json({ ok: true, reportedTo: CORO_REPORT_ADDRESS })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
