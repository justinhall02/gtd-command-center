import { useState, useEffect, useCallback } from 'react'
import type { MailFolder, EmailMessage, Suggestion } from '../types'

const API = '/api'

export function useFolders() {
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [childFolders, setChildFolders] = useState<MailFolder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/folders`)
      .then(r => r.json())
      .then(setFolders)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadChildren = useCallback(async (folderId: string) => {
    const res = await fetch(`${API}/folders/${folderId}/children`)
    const data = await res.json()
    setChildFolders(data)
    return data
  }, [])

  return { folders, childFolders, loadChildren, loading }
}

export function useMessages(folderId: string | null) {
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!folderId) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/folders/${folderId}/messages?top=50`)
      const data = await res.json()
      setMessages(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [folderId])

  useEffect(() => { load() }, [load])

  return { messages, loading, refresh: load }
}

export function useFullMessage(messageId: string | null) {
  const [message, setMessage] = useState<EmailMessage | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!messageId) {
      setMessage(null)
      setSuggestion(null)
      return
    }
    setLoading(true)
    fetch(`${API}/messages/${messageId}`)
      .then(r => r.json())
      .then(data => {
        setMessage(data.message)
        setSuggestion(data.suggestion)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [messageId])

  return { message, suggestion, loading }
}

export async function moveMessage(messageId: string, destinationFolderId: string, folderName?: string) {
  const res = await fetch(`${API}/messages/${messageId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinationFolderId, folderName }),
  })
  return res.json()
}

export async function processMessage(messageId: string, action: string, destination?: string, emailMeta?: any) {
  const res = await fetch(`${API}/messages/${messageId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, destination, emailMeta }),
  })
  return res.json()
}
