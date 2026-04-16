import { useEffect, useState } from 'react'
import { getStatus } from '../api'

export default function StatusBar() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const fetch = () => getStatus().then(setStatus).catch(() => setStatus({ db_connected: false }))
    fetch()
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [])

  const frames = status?.stats?.total_frames ?? 0
  const cameras = status?.cameras ?? []
  const connected = status?.db_connected ?? false

  return (
    <div className="flex items-center gap-6 font-mono text-[11px] tracking-wide uppercase text-muted">
      {/* DB status */}
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-500'}`}
        />
        <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
          {connected ? 'VectorAI DB' : 'DB offline'}
        </span>
      </div>

      {frames > 0 && (
        <span className="text-muted">{frames.toLocaleString()} frames indexed</span>
      )}

      {cameras.length > 0 && (
        <span className="text-muted">{cameras.join(' · ')}</span>
      )}

      {/* Privacy guarantee — supermemory stats-strip style */}
      <div className="ml-auto flex items-center gap-1.5 text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span>100% offline — no data leaves this machine</span>
      </div>
    </div>
  )
}
