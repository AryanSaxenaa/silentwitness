import { useEffect, useState } from 'react'
import { Database, Wifi, WifiOff, Camera } from 'lucide-react'
import { getStatus } from '../api'

export default function StatusBar() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    const fetch = () => getStatus().then(setStatus).catch(() => setStatus({ db_connected: false }))
    fetch()
    const interval = setInterval(fetch, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!status) return null

  return (
    <div className="flex items-center gap-4 text-xs text-gray-400">
      {/* DB connection */}
      <div className="flex items-center gap-1.5">
        <Database size={12} className={status.db_connected ? 'text-emerald-400' : 'text-red-400'} />
        <span className={status.db_connected ? 'text-emerald-400' : 'text-red-400'}>
          {status.db_connected ? 'VectorAI DB connected' : 'DB offline'}
        </span>
      </div>

      {/* Frame count */}
      {status.db_connected && status.stats && (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">|</span>
          <span>{status.stats.total_frames?.toLocaleString() ?? 0} frames indexed</span>
        </div>
      )}

      {/* Cameras */}
      {status.cameras?.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">|</span>
          <Camera size={12} />
          <span>{status.cameras.join(', ')}</span>
        </div>
      )}

      {/* Offline badge */}
      <div className="flex items-center gap-1.5 ml-auto">
        <WifiOff size={12} className="text-amber-400" />
        <span className="text-amber-400 font-medium">100% offline — no data leaves this machine</span>
      </div>
    </div>
  )
}
