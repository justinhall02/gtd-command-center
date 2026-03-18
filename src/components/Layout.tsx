import type { Mode } from '../types'

interface Props {
  mode: Mode
  onModeChange: (mode: Mode) => void
  children: React.ReactNode
}

export default function Layout({ mode, onModeChange, children }: Props) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-accent font-semibold text-sm tracking-wider">▸ GTD COMMAND CENTER</span>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => onModeChange('process')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider transition-all ${
              mode === 'process'
                ? 'bg-accent text-bg'
                : 'text-text-dim hover:text-text hover:bg-surface'
            }`}
          >
            PROCESS
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
