import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import foldersRouter from './routes/folders.js'
import messagesRouter from './routes/messages.js'
import listsRouter from './routes/lists.js'
import tasksRouter from './routes/tasks.js'
import executeRouter from './routes/execute.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3456')

app.use(cors())
app.use(express.json())

app.use('/api/folders', foldersRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/lists', listsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/execute', executeRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const server = app.listen(PORT, () => {
  console.log(`GTD Command Center API on http://localhost:${PORT}`)
})

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  console.log('WebSocket client connected')
  ws.on('close', () => console.log('WebSocket client disconnected'))
})

export function broadcast(data: any) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg)
  })
}
