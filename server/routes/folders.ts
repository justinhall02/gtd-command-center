import { Router } from 'express'
import { graph } from '../services/graph.js'

const router = Router()

// List root mail folders
router.get('/', async (_req, res) => {
  try {
    const folders = await graph.listFolders()
    res.json(folders)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// List child folders of a folder
router.get('/:id/children', async (req, res) => {
  try {
    const children = await graph.listChildFolders(req.params.id)
    res.json(children)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// List messages in a folder
router.get('/:id/messages', async (req, res) => {
  try {
    const top = parseInt(req.query.top as string) || 20
    const skip = parseInt(req.query.skip as string) || 0
    const messages = await graph.listMessages(req.params.id, top, skip)
    res.json(messages)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
