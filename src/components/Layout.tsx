import type { AppMode } from '../App'

interface Props {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  children: React.ReactNode
}

export default function Layout({ mode, onModeChange, children }: Props) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => onModeChange('home')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <span className="text-accent font-semibold text-sm tracking-wider">▸ GTD COMMAND CENTER</span>
        </button>

        <div className="flex gap-1">
          <button
            onClick={() => onModeChange('home')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider transition-all ${
              mode === 'home'
                ? 'bg-accent text-bg'
                : 'text-text-dim hover:text-text hover:bg-surface'
            }`}
          >
            HOME
          </button>
          <button
            onClick={() => onModeChange('process')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider transition-all ${
              mode === 'process'
                ? 'bg-accent text-bg'
                : 'text-text-dim hover:text-text hover:bg-surface'
            }`}
          >
            INBOX
          </button>
          <button
            onClick={() => onModeChange('execute')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider transition-all ${
              mode === 'execute'
                ? 'bg-accent text-bg'
                : 'text-text-dim hover:text-text hover:bg-surface'
            }`}
          >
            EXECUTE
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}
