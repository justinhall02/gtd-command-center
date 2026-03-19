import { useState } from 'react'
import type { Mode } from './types'
import Layout from './components/Layout'
import Home from './components/Home'
import ProcessMode from './components/ProcessMode'
import ExecuteMode from './components/ExecuteMode'

export type AppMode = Mode | 'home'

export default function App() {
  const [mode, setMode] = useState<AppMode>('home')
  const [initialFolderId, setInitialFolderId] = useState<string | null>(null)

  const navigateToFolder = (folderId: string) => {
    setInitialFolderId(folderId)
    setMode('process')
  }

  const handleModeChange = (newMode: AppMode) => {
    if (newMode !== 'process') setInitialFolderId(null)
    setMode(newMode)
  }

  return (
    <Layout mode={mode} onModeChange={handleModeChange}>
      {mode === 'home' && <Home onNavigate={handleModeChange} onOpenFolder={navigateToFolder} />}
      {mode === 'process' && <ProcessMode initialFolderId={initialFolderId} />}
      {mode === 'execute' && <ExecuteMode />}
    </Layout>
  )
}
