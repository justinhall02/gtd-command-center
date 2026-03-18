export interface MailFolder {
  id: string
  displayName: string
  unreadItemCount: number
  totalItemCount: number
  childFolderCount?: number
}

export interface EmailMessage {
  id: string
  subject: string
  from: {
    emailAddress: { name: string; address: string }
  }
  bodyPreview: string
  body?: { content: string; contentType: string }
  receivedDateTime: string
  isRead: boolean
  hasAttachments: boolean
}

export interface TodoList {
  id: string
  displayName: string
  isOwner: boolean
  isShared: boolean
}

export interface Task {
  id: string
  m365_task_id: string | null
  m365_list_id: string | null
  source_email_id: string | null
  source_email_subject: string | null
  source_email_from: string | null
  title: string
  body: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  claude_type: 'autonomous' | 'guided' | 'manual'
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  execution_log: string | null
  created_at: string
  completed_at: string | null
}

export interface Suggestion {
  action: string
  confidence: number
  matchCount: number
}

export type Mode = 'process' | 'execute'
