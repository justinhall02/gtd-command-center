import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { exec } from 'child_process'
import db from '../db.js'

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
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf-8')) }
      catch { return null }
    })
    .filter(Boolean)
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

  const cmdPath = path.join(COMMANDS_DIR, `${commandId}.json`)
  if (fs.existsSync(cmdPath)) {
    fs.unlinkSync(cmdPath)
  }
}

// --- Session Launcher ---

interface TaskForSession {
  id: string
  title: string
  claude_type: string
  body: string | null
  source_email_from: string | null
  source_email_subject: string | null
  claude_action: string | null
}

const SESSION_LOCK_FILE = '/tmp/gtd-session-active.lock'

export function isSessionActive(): boolean {
  // Check if lock file exists AND if there are in_progress tasks
  if (!fs.existsSync(SESSION_LOCK_FILE)) return false
  const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'in_progress'").get() as { cnt: number }
  if (inProgress.cnt === 0) {
    // All tasks done — clean up stale lock
    try { fs.unlinkSync(SESSION_LOCK_FILE) } catch {}
    return false
  }
  return true
}

export function buildSessionPrompt(tasks: TaskForSession[]): string {
  const taskList = tasks.map((t, i) => {
    let section = `\n## TASK ${i + 1} of ${tasks.length}: ${t.title}\n`
    section += `- **ID**: ${t.id}\n`
    section += `- **Type**: ${t.claude_type}\n`
    if (t.source_email_from) section += `- **From**: ${t.source_email_from}\n`
    if (t.source_email_subject) section += `- **Subject**: ${t.source_email_subject}\n`
    if (t.body) section += `- **Details**: ${t.body}\n`
    if (t.claude_action) {
      try {
        const action = JSON.parse(t.claude_action)
        if (action.skill) section += `- **Skill**: ${action.skill}\n`
      } catch { /* ignore */ }
    }
    section += `- **Complete it**: When done, run: curl -s -X PATCH http://localhost:3456/api/tasks/${t.id} -H "Content-Type: application/json" -d '{"status":"completed"}'\n`
    return section
  }).join('\n')

  return `You are an autonomous GTD executor working through a task list for Justin Hall, owner of Justin Hall Consulting (Cat6 low voltage cabling, Metro Atlanta) and Southern Culinary Tours (Atlanta food tours).

# YOUR TASK LIST

Work through these tasks in order. For each task:
1. Read the task details
2. Execute it using your available tools (M365 email, HubSpot CRM, Chrome browser, etc.)
3. When complete, mark it done by running the curl command provided
4. Move to the next task

For **autonomous** tasks: just do it.
For **guided** tasks: explain what you plan to do and wait for Justin's input before proceeding.
For **manual** tasks: tell Justin what he needs to do and mark it complete when he confirms.

If you get stuck or need clarification, ask Justin — he's right here in this terminal.

# AVAILABLE TOOLS
- M365: Send/read email, manage calendar, manage tasks
- HubSpot: CRM, contacts, deals, quotes (/create-quote skill)
- Chrome: Browser automation for web tasks
- File system: Read/write files, run commands

# TASK LIST
${taskList}

Start with Task 1. Go.`
}

export function launchSession(tasks: TaskForSession[]): { promptFile: string } {
  const prompt = buildSessionPrompt(tasks)
  const promptFile = '/tmp/gtd-session-prompt.txt'
  const initialPromptFile = '/tmp/gtd-session-initial.txt'
  const initialPrompt = `Start working through the GTD task list. You have ${tasks.length} tasks. Begin with Task 1: ${tasks[0]?.title || 'unknown'}`

  // Write both prompts to files (avoids shell injection from email subjects)
  fs.writeFileSync(promptFile, prompt)
  fs.writeFileSync(initialPromptFile, initialPrompt)

  // Write session lock file
  fs.writeFileSync(SESSION_LOCK_FILE, JSON.stringify({
    startedAt: new Date().toISOString(),
    taskCount: tasks.length,
    taskIds: tasks.map(t => t.id),
  }))

  // Launch Claude in Windows Terminal via WSL
  // All user-supplied content is in files, not inline — prevents shell injection
  const cmd = `cmd.exe /c start wt wsl -e bash -c "cd /mnt/c/Users/JustinHall/gtd-command-center && claude --dangerously-skip-permissions --chrome --name 'GTD Execute Session' --system-prompt \\"$(cat ${promptFile})\\" \\"$(cat ${initialPromptFile})\\""`

  console.log(`[SESSION] Launching Claude session with ${tasks.length} tasks`)

  exec(cmd, (error) => {
    if (error) console.error('[SESSION] Launch error:', error.message)
  })

  // Mark all tasks as in_progress
  const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?')
  for (const task of tasks) {
    stmt.run('in_progress', task.id)
  }

  console.log(`[SESSION] Launched — lock file at ${SESSION_LOCK_FILE}`)
  return { promptFile }
}
