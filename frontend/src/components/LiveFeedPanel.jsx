import { useState, useEffect } from 'react'
import { Radio, Square, Loader2, Circle } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function LiveFeedPanel() {
  const [status, setStatus] = useState({})
  const [starting, setStarting] = useState(false)
  const [source, setSource] = useState('0')
  const [cameraId, setCameraId] = useState('live')
  const [fps, setFps] = useState(1)

  // Poll status every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/live/status`)
        setStatus(data)
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleStart = async () => {
    setStarting(true)
    try {
      await axios.post(`${API_BASE}/api/live/start`, {
        source: String(source),
        camera_id: cameraId,
        fps_sample: fps,
        min_motion_score: 0.01,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async (camId) => {
    try {
      await axios.post(`${API_BASE}/api/live/stop?camera_id=${camId}`)
    } catch {}
  }

  const activeFeeds = Object.entries(status).filter(([, s]) => s.running)
  const hasActive = activeFeeds.length > 0

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <Radio size={14} className="text-red-400" />
        Live Feed
      </h3>

      {/* Active feeds */}
      {activeFeeds.map(([camId, s]) => (
        <div key={camId} className="glass rounded-lg p-3 border border-red-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Circle size={8} className="text-red-400 fill-red-400 animate-pulse" />
              <span className="text-sm font-medium text-gray-200">{s.camera_id}</span>
            </div>
            <button
              onClick={() => handleStop(camId)}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Square size={11} />
              Stop
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div>
              <div className="text-gray-400 font-medium">{s.frames_indexed}</div>
              <div className="text-gray-600">indexed</div>
            </div>
            <div>
              <div className="text-gray-400 font-medium">{s.frames_captured}</div>
              <div className="text-gray-600">captured</div>
            </div>
            <div>
              <div className="text-amber-400 font-medium">{s.frames_dropped}</div>
              <div className="text-gray-600">dropped</div>
            </div>
          </div>
          {s.error && (
            <div className="mt-2 text-xs text-red-400">{s.error}</div>
          )}
        </div>
      ))}

      {/* Start new feed */}
      {!hasActive && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="0 = webcam, or RTSP URL"
              className="input-field text-sm py-2"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              0 = built-in webcam · 1 = external USB camera · rtsp://... = IP camera
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Camera ID</label>
              <input
                type="text"
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                placeholder="live"
                className="input-field text-sm py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">FPS sample</label>
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.5}
                value={fps}
                onChange={(e) => setFps(parseFloat(e.target.value))}
                className="input-field text-sm py-2"
              />
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {starting ? (
              <><Loader2 size={14} className="animate-spin" /> Starting...</>
            ) : (
              <><Radio size={14} /> Start live indexing</>
            )}
          </button>

          <p className="text-[10px] text-gray-600 leading-relaxed">
            Motion-gated: only frames with activity are indexed. New frames
            are searchable within seconds of capture.
          </p>
        </div>
      )}
    </div>
  )
}
