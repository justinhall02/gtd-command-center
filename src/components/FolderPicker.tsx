import { useState, useEffect } from 'react'
import type { MailFolder } from '../types'

interface Props {
  folders: MailFolder[]
  selected: string | null
  onSelect: (folderId: string, folderName: string) => void
  label?: string
}

export default function FolderPicker({ folders, selected, onSelect, label = 'Folder' }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-text-dim text-xs">{label}:</span>
      <select
        value={selected || ''}
        onChange={(e) => {
          const folder = folders.find(f => f.id === e.target.value)
          if (folder) onSelect(folder.id, folder.displayName)
        }}
        className="bg-surface border border-border text-text text-xs px-3 py-1.5 focus:outline-none focus:border-accent"
      >
        <option value="">Select folder...</option>
        {folders.map(f => (
          <option key={f.id} value={f.id}>
            {f.displayName} ({f.unreadItemCount}/{f.totalItemCount})
          </option>
        ))}
      </select>
    </div>
  )
}
