import { useEffect, useState } from 'react'
import { getStatus } from '../api'

export default function StatusBar() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const fetch = () => getStatus().then(setStatus).catch(() => setStatus({ db_connected: false }))
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  const frames = status?.stats?.total_frames ?? 0
  const cameras = status?.cameras ?? []
  const connected = status?.db_connected ?? false

  return (
    <div className="flex items-center gap-4 font-mono text-[10px] tracking-wide flex-wrap" style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-500'}`}
        />
        <span className={connected ? 'text-emerald-400' : 'text-red-400'} style={{ letterSpacing: '0.08em' }}>
          {connected ? 'VectorAI DB' : 'DB offline'}
        </span>
      </div>

      {frames > 0 && (
        <span style={{ color: 'var(--text-secondary)' }}>{frames.toLocaleString()} frames indexed</span>
      )}

      {cameras.length > 0 && (
        <span style={{ color: 'var(--text-secondary)' }}>{cameras.join(' · ')}</span>
      )}

      <div className="ml-auto flex items-center gap-1.5" style={{ color: 'var(--accent-soft)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--signal)', boxShadow: '0 0 10px rgba(255,94,7,0.6)' }} />
        <span>100% offline — no data leaves this machine</span>
      </div>
    </div>
  )
}
