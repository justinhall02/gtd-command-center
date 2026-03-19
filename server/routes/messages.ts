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
      console.log(`[DELETE] Moving message ${req.params.id.slice(0, 30)}... to Deleted Items`)
      try {
        await graph.moveMessage(req.params.id, 'deleteditems')
        console.log(`[DELETE] Success`)
      } catch (moveErr: any) {
        console.error(`[DELETE] FAILED:`, moveErr.message)
        throw moveErr
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

// Report message as spam or phishing to Microsoft Defender (trains EOP filter)
router.post('/:id/report-spam', async (req, res) => {
  try {
    const { reportAction, emailMeta } = req.body
    const action = reportAction === 'phish' ? 'phish' : 'junk'

    console.log(`[REPORT] Reporting message ${req.params.id.slice(0, 30)}... as ${action}`)
    await graph.reportMessage(req.params.id, action)
    console.log(`[REPORT] Success — reported as ${action}, message moved by Defender`)

    // Record in processed emails
    db.prepare(`
      INSERT OR REPLACE INTO processed_emails (email_id, action, destination)
      VALUES (?, ?, ?)
    `).run(req.params.id, `reported_${action}`, action === 'phish' ? 'Deleted Items' : 'Junk Email')

    // Record decision for learning
    if (emailMeta) {
      recordDecision('process', emailMeta, `report_${action}`)
    }

    res.json({ ok: true, reportedAs: action })
  } catch (err: any) {
    console.error(`[REPORT] FAILED:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
