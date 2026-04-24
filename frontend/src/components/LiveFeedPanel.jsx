import { useState, useEffect } from 'react'
import { Radio, Square, Loader2, Circle } from 'lucide-react'
import { startLiveFeed, stopLiveFeed, getLiveStatus } from '../api'
import Tooltip from './Tooltip'

export default function LiveFeedPanel() {
  const [status, setStatus] = useState({})
  const [starting, setStarting] = useState(false)
  const [source, setSource] = useState('0')
  const [cameraId, setCameraId] = useState('live')
  const [fps, setFps] = useState(1)

  // Poll status every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try { setStatus(await getLiveStatus()) } catch {}
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleStart = async () => {
    setStarting(true)
    try {
      await startLiveFeed({ source, cameraId, fpsSample: fps, minMotionScore: 0.01 })
    } catch (e) {
      console.error(e)
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async (camId) => {
    try { await stopLiveFeed(camId) } catch {}
  }

  const activeFeeds = Object.entries(status).filter(([, s]) => s.running)
  const hasActive = activeFeeds.length > 0
  const helperTextStyle = {
    color: 'var(--text-muted)',
    textTransform: 'none',
    letterSpacing: 'normal',
    fontSize: '11px',
    lineHeight: '1.55',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    display: 'block',
    width: '100%',
    maxWidth: '100%',
  }
  const helperTinyStyle = {
    ...helperTextStyle,
    fontSize: '10px',
  }

  return (
    <div className="space-y-4 min-w-0">
      <p className="section-label" style={helperTextStyle}>
        Live capture is optional. Use it only if you want to index a webcam or RTSP source in real time.
      </p>

      {/* Active feeds */}
      {activeFeeds.map(([camId, s]) => (
        <div
          key={camId}
          className="rounded-xl p-3"
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Circle
                size={8}
                style={{ color: '#EF4444', fill: '#EF4444' }}
                className="animate-pulse"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {s.camera_id}
              </span>
            </div>
            <Tooltip content={`Stop live capture for ${camId}`}>
              <button
                onClick={() => handleStop(camId)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: '#FCA5A5' }}
                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                onMouseLeave={e => e.currentTarget.style.color = '#FCA5A5'}
              >
                <Square size={11} />
                Stop
              </button>
            </Tooltip>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center" style={{ fontSize: '12px' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.frames_indexed}</div>
              <div className="section-label">indexed</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.frames_captured}</div>
              <div className="section-label">captured</div>
            </div>
            <div>
              <div style={{ color: s.frames_dropped > 0 ? '#FCD34D' : 'var(--text-primary)', fontWeight: 600 }}>
                {s.frames_dropped}
              </div>
              <div className="section-label">dropped</div>
            </div>
          </div>
          {s.error && (
            <div className="mt-2 text-xs" style={{ color: '#FCA5A5' }}>{s.error}</div>
          )}
        </div>
      ))}

      {/* Start new feed form */}
      {!hasActive && (
        <div className="space-y-3">
          <div>
            <label className="section-label block mb-2">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="0 = webcam, or RTSP URL"
              className="input-field"
              style={{ fontSize: '13px' }}
            />
            <p className="section-label mt-1" style={helperTinyStyle}>
              0 = built-in webcam · 1 = external USB · rtsp://... = IP camera
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="section-label block mb-2">Camera ID</label>
              <input
                type="text"
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                placeholder="live"
                className="input-field"
                style={{ fontSize: '13px' }}
              />
            </div>
            <div>
              <label className="section-label block mb-2">FPS sample</label>
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.5}
                value={fps}
                onChange={(e) => setFps(parseFloat(e.target.value))}
                className="input-field"
                style={{ fontSize: '13px', fontFamily: 'var(--mono)' }}
              />
            </div>
          </div>

          <Tooltip content="Start indexing frames from the selected live source">
            <button
              onClick={handleStart}
              disabled={starting}
              className="btn-primary w-full justify-center"
              style={{ fontSize: '13px' }}
            >
              {starting ? (
                <><Loader2 size={14} className="animate-spin" /> Starting...</>
              ) : (
                <><Radio size={14} /> Start live indexing</>
              )}
            </button>
          </Tooltip>

          <p className="section-label" style={helperTextStyle}>
            Motion-gated — only frames with activity are indexed. New frames are searchable within seconds of capture.
          </p>
        </div>
      )}
    </div>
  )
}
