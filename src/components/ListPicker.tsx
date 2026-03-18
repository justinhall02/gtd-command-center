import type { TodoList } from '../types'

interface Props {
  lists: TodoList[]
  selected: Set<string>
  onToggle: (listId: string) => void
}

export default function ListPicker({ lists, selected, onToggle }: Props) {
  // Show commonly used lists first, then alphabetical
  const priorityLists = ['Tasks', 'Outstand Quotes', 'Admin List', 'SCT', 'Big Week', 'Need to invoice', 'Certification List']

  const sorted = [...lists].sort((a, b) => {
    const aIdx = priorityLists.indexOf(a.displayName)
    const bIdx = priorityLists.indexOf(b.displayName)
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
    if (aIdx !== -1) return -1
    if (bIdx !== -1) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.slice(0, 12).map(list => (
        <button
          key={list.id}
          onClick={() => onToggle(list.id)}
          className={`px-3 py-1 text-xs transition-colors ${
            selected.has(list.id)
              ? 'bg-accent text-bg font-medium'
              : 'border border-border text-text-dim hover:text-text hover:border-text-dim'
          }`}
        >
          {selected.has(list.id) ? '■' : '□'} {list.displayName}
        </button>
      ))}
    </div>
  )
}
