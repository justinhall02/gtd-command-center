import { Router } from 'express'
import { graph } from '../services/graph.js'

const router = Router()

// List all To Do lists
router.get('/', async (_req, res) => {
  try {
    const lists = await graph.listTodoLists()
    res.json(lists)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Get tasks from a list
router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await graph.listTodoTasks(req.params.id)
    res.json(tasks)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
