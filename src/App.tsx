import { useState } from 'react'
import type { Mode } from './types'
import Layout from './components/Layout'
import Home from './components/Home'
import ProcessMode from './components/ProcessMode'
import ExecuteMode from './components/ExecuteMode'

export default function App() {
  const [mode, setMode] = useState<Mode | 'home'>('home')

  return (
    <Layout mode={mode} onModeChange={setMode}>
      {mode === 'home' && <Home onNavigate={setMode} />}
      {mode === 'process' && <ProcessMode />}
      {mode === 'execute' && <ExecuteMode />}
    </Layout>
  )
}
