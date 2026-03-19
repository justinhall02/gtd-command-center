import { useState, useEffect, useCallback } from 'react'
import type { MailFolder, Suggestion } from '../types'
import { useFolders, useMessages, processMessage, moveMessage, reportToCoro } from '../hooks/useEmails'
import { useTodoLists } from '../hooks/useTasks'
import FolderPicker from './FolderPicker'
import EmailCard from './EmailCard'
import TaskForm from './TaskForm'

interface Props {
  initialFolderId?: string | null
}

export default function ProcessMode({ initialFolderId }: Props) {
  const { folders, childFolders, loadChildren, loading: foldersLoading } = useFolders()
  const { lists } = useTodoLists()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolderId || null)
  const [allFolders, setAllFolders] = useState<MailFolder[]>([])
  const { messages, loading: msgsLoading, refresh } = useMessages(selectedFolder)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [showMisrouteMenu, setShowMisrouteMenu] = useState(false)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)

  // Load Inbox child folders on mount
  useEffect(() => {
    const inbox = folders.find(f => f.displayName === 'Inbox')
    if (inbox) {
      loadChildren(inbox.id).then(children => {
        setAllFolders([...folders, ...children])
      })
    } else {
      setAllFolders(folders)
    }
  }, [folders, loadChildren])

  // Auto-select: use initialFolderId if provided, else "3: Today", else Inbox
  useEffect(() => {
    if (!selectedFolder && allFolders.length > 0) {
      if (initialFolderId) {
        setSelectedFolder(initialFolderId)
      } else {
        const today = allFolders.find(f => f.displayName === '3: Today')
        const inbox = allFolders.find(f => f.displayName === 'Inbox')
        const target = today || inbox
        if (target) setSelectedFolder(target.id)
      }
    }
  }, [allFolders, selectedFolder, initialFolderId])

  const currentEmail = messages[currentIndex]

  const advanceToNext = useCallback(() => {
    setShowTaskForm(false)
    setShowMoveMenu(false)
    setShowMisrouteMenu(false)
    setSuggestion(null)
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      refresh()
      setCurrentIndex(0)
    }
  }, [currentIndex, messages.length, refresh])

  const handleDelete = async () => {
    if (!currentEmail) return
    await processMessage(currentEmail.id, 'delete', undefined, {
      from: currentEmail.from.emailAddress.address,
      subject: currentEmail.subject,
      hasAttachments: currentEmail.hasAttachments,
    })
    advanceToNext()
  }

  const handleSkip = () => {
    advanceToNext()
  }

  const handleMove = async (folderId: string, folderName: string) => {
    if (!currentEmail) return
    await moveMessage(currentEmail.id, folderId, folderName)
    await processMessage(currentEmail.id, 'moved', folderName, {
      from: currentEmail.from.emailAddress.address,
      subject: currentEmail.subject,
      hasAttachments: currentEmail.hasAttachments,
    })
    setShowMoveMenu(false)
    advanceToNext()
  }

  const handleMisroute = async (folderId: string, folderName: string) => {
    if (!currentEmail) return
    // Find what folder this email is currently in
    const currentFolderName = allFolders.find(f => f.id === selectedFolder)?.displayName || 'unknown'
    await moveMessage(currentEmail.id, folderId, folderName)
    await processMessage(currentEmail.id, 'misrouted', folderName, {
      from: currentEmail.from.emailAddress.address,
      subject: currentEmail.subject,
      hasAttachments: currentEmail.hasAttachments,
      folder: currentFolderName,
      correctedTo: folderName,
    })
    setShowMisrouteMenu(false)
    advanceToNext()
  }

  const handleReportCoro = async () => {
    if (!currentEmail) return
    await reportToCoro(currentEmail.id, 'suspicious', {
      from: currentEmail.from.emailAddress.address,
      subject: currentEmail.subject,
      hasAttachments: currentEmail.hasAttachments,
    })
    advanceToNext()
  }

  // Detect quote-related emails
  const isQuoteEmail = currentEmail ? (() => {
    const all = `${currentEmail.subject} ${currentEmail.bodyPreview}`.toLowerCase()
    return /quote|pricing|proposal|estimate|bid|rfp|install|cabling|cat6|network|low voltage|fiber/.test(all)
  })() : false

  const handleQuoteIt = async () => {
    if (!currentEmail) return
    // Queue a command for Claude Code to run /create-quote
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Quote: ${currentEmail.subject}`,
        body: currentEmail.bodyPreview,
        claude_type: 'autonomous',
        claude_action: JSON.stringify({
          skill: '/create-quote',
          source_email: currentEmail.id,
          from: currentEmail.from.emailAddress.address,
          subject: currentEmail.subject,
        }),
        source_email_id: currentEmail.id,
        source_email_subject: currentEmail.subject,
        source_email_from: currentEmail.from.emailAddress.address,
        emailMeta: {
          from: currentEmail.from.emailAddress.address,
          subject: currentEmail.subject,
          hasAttachments: currentEmail.hasAttachments,
        },
      }),
    })
    const task = await res.json()
    // Immediately queue for execution
    await fetch(`/api/tasks/${task.id}/queue`, { method: 'POST' })
    advanceToNext()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showTaskForm) return // Don't capture when typing
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); if (isQuoteEmail) handleQuoteIt() }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setShowTaskForm(true) }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setShowMoveMenu(!showMoveMenu); setShowMisrouteMenu(false) }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setShowMisrouteMenu(!showMisrouteMenu); setShowMoveMenu(false) }
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleReportCoro() }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); handleDelete() }
      if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); handleSkip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showTaskForm, showMoveMenu, showMisrouteMenu, handleDelete, handleSkip])

  if (foldersLoading) {
    return <div className="text-text-dim text-xs">Loading folders...</div>
  }

  return (
    <div>
      {/* Folder selector */}
      <div className="flex items-center justify-between mb-4">
        <FolderPicker
          folders={allFolders}
          selected={selectedFolder}
          onSelect={(id) => {
            setSelectedFolder(id)
            setCurrentIndex(0)
          }}
        />
        {selectedFolder && messages.length > 0 && (
          <span className="text-text-dim text-xs">
            {messages.filter(m => !m.isRead).length} unread · {messages.length} total
          </span>
        )}
      </div>

      {/* Loading state */}
      {msgsLoading && (
        <div className="text-text-dim text-xs py-8 text-center">Loading emails...</div>
      )}

      {/* Empty state */}
      {!msgsLoading && messages.length === 0 && selectedFolder && (
        <div className="text-text-dim text-xs py-8 text-center border border-border bg-surface">
          No emails in this folder. Inbox zero!
        </div>
      )}

      {/* Current email */}
      {currentEmail && !msgsLoading && (
        <>
          <EmailCard
            email={currentEmail}
            suggestion={suggestion}
            index={currentIndex}
            total={messages.length}
            onAddTask={() => setShowTaskForm(true)}
            onMove={() => { setShowMoveMenu(!showMoveMenu); setShowMisrouteMenu(false) }}
            onMisrouted={() => { setShowMisrouteMenu(!showMisrouteMenu); setShowMoveMenu(false) }}
            onReportCoro={handleReportCoro}
            onQuoteIt={handleQuoteIt}
            onArchive={handleDelete}
            onSkip={handleSkip}
            isQuoteEmail={isQuoteEmail}
          />

          {/* Task form */}
          {showTaskForm && (
            <TaskForm
              email={currentEmail}
              lists={lists}
              onSaved={advanceToNext}
              onCancel={() => setShowTaskForm(false)}
            />
          )}

          {/* Move menu */}
          {showMoveMenu && (
            <div className="border border-border bg-surface mt-2 max-h-64 overflow-y-auto">
              <div className="px-4 py-2 border-b border-border text-accent text-xs font-medium tracking-wider">
                MOVE TO FOLDER
              </div>
              {allFolders
                .filter(f => f.id !== selectedFolder)
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMove(f.id, f.displayName)}
                    className="w-full text-left px-4 py-2 text-xs text-text hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
                  >
                    {f.displayName}
                    <span className="text-text-dim ml-2">({f.totalItemCount})</span>
                  </button>
                ))}
            </div>
          )}

          {/* Misroute menu */}
          {showMisrouteMenu && (
            <div className="border border-danger/40 bg-surface mt-2 max-h-64 overflow-y-auto">
              <div className="px-4 py-2 border-b border-danger/30 text-danger text-xs font-medium tracking-wider">
                MISROUTED — WHERE SHOULD THIS GO?
              </div>
              {allFolders
                .filter(f => f.id !== selectedFolder)
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMisroute(f.id, f.displayName)}
                    className="w-full text-left px-4 py-2 text-xs text-text hover:bg-danger/10 hover:text-danger transition-colors border-b border-border last:border-b-0"
                  >
                    {f.displayName}
                    <span className="text-text-dim ml-2">({f.totalItemCount})</span>
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {/* Keyboard shortcut hint */}
      <div className="mt-6 text-center text-text-dim text-xs opacity-50">
        [Q] quote it · [T] add task · [M] move · [R] misrouted · [C] coro · [D] delete · [→] skip
      </div>
    </div>
  )
}
