import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(import.meta.dirname, '..', 'data', 'gtd.db')

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    m365_task_id TEXT,
    m365_list_id TEXT,
    source_email_id TEXT,
    source_email_subject TEXT,
    source_email_from TEXT,
    title TEXT NOT NULL,
    body TEXT,
    priority TEXT DEFAULT 'normal',
    claude_type TEXT DEFAULT 'manual',
    claude_action TEXT,
    status TEXT DEFAULT 'pending',
    execution_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS processed_emails (
    email_id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    destination TEXT,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    input_fingerprint TEXT,
    input_features TEXT,
    suggested_action TEXT,
    actual_action TEXT NOT NULL,
    tools_used TEXT,
    was_correction INTEGER DEFAULT 0,
    correction_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_decisions_fingerprint ON decisions(input_fingerprint);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_claude_type ON tasks(claude_type);
`)

export default db
