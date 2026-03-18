import { useState, useEffect, useCallback } from 'react'
import type { MailFolder, Suggestion } from '../types'
import { useFolders, useMessages, processMessage, moveMessage } from '../hooks/useEmails'
import { useTodoLists } from '../hooks/useTasks'
import FolderPicker from './FolderPicker'
import EmailCard from './EmailCard'
import TaskForm from './TaskForm'

export default function ProcessMode() {
  const { folders, childFolders, loadChildren, loading: foldersLoading } = useFolders()
  const { lists } = useTodoLists()
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [allFolders, setAllFolders] = useState<MailFolder[]>([])
  const { messages, loading: msgsLoading, refresh } = useMessages(selectedFolder)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
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

  // Auto-select "3: Today" (Now folder) or Inbox
  useEffect(() => {
    if (!selectedFolder && allFolders.length > 0) {
      const today = allFolders.find(f => f.displayName === '3: Today')
      const inbox = allFolders.find(f => f.displayName === 'Inbox')
      const target = today || inbox
      if (target) setSelectedFolder(target.id)
    }
  }, [allFolders, selectedFolder])

  const currentEmail = messages[currentIndex]

  const advanceToNext = useCallback(() => {
    setShowTaskForm(false)
    setShowMoveMenu(false)
    setSuggestion(null)
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      refresh()
      setCurrentIndex(0)
    }
  }, [currentIndex, messages.length, refresh])

  const handleArchive = async () => {
    if (!currentEmail) return
    await processMessage(currentEmail.id, 'archive', undefined, {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showTaskForm) return // Don't capture when typing
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setShowTaskForm(true) }
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setShowMoveMenu(!showMoveMenu) }
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); handleArchive() }
      if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); handleSkip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showTaskForm, showMoveMenu, handleArchive, handleSkip])

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
            onMove={() => setShowMoveMenu(!showMoveMenu)}
            onArchive={handleArchive}
            onSkip={handleSkip}
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
        </>
      )}

      {/* Keyboard shortcut hint */}
      <div className="mt-6 text-center text-text-dim text-xs opacity-50">
        [T] add task · [M] move · [A] archive · [→] skip
      </div>
    </div>
  )
}
