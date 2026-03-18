import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'

const COMMANDS_DIR = path.join(import.meta.dirname, '..', '..', 'data', 'pending-commands')
const RESULTS_DIR = path.join(import.meta.dirname, '..', '..', 'data', 'results')

export interface ClaudeCommand {
  id: string
  taskId: string
  type: 'autonomous' | 'guided'
  title: string
  context: string
  sourceEmail?: {
    from: string
    subject: string
    body: string
  }
  createdAt: string
}

export interface ClaudeResult {
  commandId: string
  taskId: string
  status: 'success' | 'error' | 'needs_input'
  summary: string
  actions: string[]
  createdAt: string
}

export function queueCommand(command: Omit<ClaudeCommand, 'id' | 'createdAt'>): ClaudeCommand {
  const cmd: ClaudeCommand = {
    ...command,
    id: uuid(),
    createdAt: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(COMMANDS_DIR, `${cmd.id}.json`),
    JSON.stringify(cmd, null, 2)
  )

  return cmd
}

export function getResult(commandId: string): ClaudeResult | null {
  const resultPath = path.join(RESULTS_DIR, `${commandId}.json`)
  if (!fs.existsSync(resultPath)) return null
  return JSON.parse(fs.readFileSync(resultPath, 'utf-8'))
}

export function listPendingCommands(): ClaudeCommand[] {
  if (!fs.existsSync(COMMANDS_DIR)) return []
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf-8')))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function completeCommand(commandId: string, result: Omit<ClaudeResult, 'createdAt'>): void {
  const fullResult: ClaudeResult = {
    ...result,
    createdAt: new Date().toISOString(),
  }

  fs.writeFileSync(
    path.join(RESULTS_DIR, `${commandId}.json`),
    JSON.stringify(fullResult, null, 2)
  )

  // Remove from pending
  const cmdPath = path.join(COMMANDS_DIR, `${commandId}.json`)
  if (fs.existsSync(cmdPath)) {
    fs.unlinkSync(cmdPath)
  }
}
