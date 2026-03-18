import { useState } from 'react'
import type { Mode } from './types'
import Layout from './components/Layout'
import ProcessMode from './components/ProcessMode'
import ExecuteMode from './components/ExecuteMode'

export default function App() {
  const [mode, setMode] = useState<Mode>('process')

  return (
    <Layout mode={mode} onModeChange={setMode}>
      {mode === 'process' ? <ProcessMode /> : <ExecuteMode />}
    </Layout>
  )
}
