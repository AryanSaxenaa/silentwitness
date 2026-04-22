import { useEffect } from 'react'
import { X, Clock, Camera, Activity } from 'lucide-react'
import { thumbnailUrl } from '../api'

function fmt(isoStr) {
  if (!isoStr) return '--'
  try { return new Date(isoStr).toLocaleString() }
  catch { return isoStr }
}

export default function FrameModal({ frame, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  if (!frame) return null
  const thumb = thumbnailUrl(frame.thumbnail_path)
  const pct = Math.round((frame.score || 0) * 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,22,48,0.92)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl animate-fade-up"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-hover)',
          borderRadius: '22px',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(18px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <Camera size={14} style={{ color: 'var(--accent)' }} />
            <span className="font-mono text-sm font-medium" style={{ color: 'var(--accent)' }}>
              {frame.camera_id}
            </span>
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              {frame.video_file}
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '5px 8px', borderRadius: '8px' }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ aspectRatio: '16/9', background: 'var(--bg-base)' }}>
          {thumb
            ? <img src={thumb} alt="Selected frame" className="w-full h-full object-contain" />
            : <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <Camera size={40} />
              </div>
          }
        </div>

        <div className="grid grid-cols-4" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Match score', value: `${pct}%`, accent: pct >= 70 },
            { label: 'Timestamp', value: `${frame.timestamp_sec}s`, mono: true },
            { label: 'Motion', value: `${Math.round((frame.motion_score || 0) * 100)}%`, mono: true },
            { label: 'Recorded', value: fmt(frame.absolute_time)?.split(', ')[1] || '--', small: true },
          ].map(({ label, value, accent, mono, small }) => (
            <div
              key={label}
              className="px-4 py-4"
              style={{ borderRight: '1px solid var(--border)' }}
            >
              <div
                className="font-semibold mb-1"
                style={{
                  color: accent ? 'var(--accent-soft)' : 'var(--text-primary)',
                  fontSize: small ? '12px' : '16px',
                  fontFamily: mono ? 'var(--mono)' : undefined,
                }}
              >
                {value}
              </div>
              <div className="section-label">{label}</div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3" style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Jump to <span style={{ color: 'var(--text-secondary)' }}>{frame.timestamp_sec}s</span> in{' '}
            <span style={{ color: 'var(--text-secondary)' }}>{frame.video_file}</span> to view in context
          </p>
        </div>
      </div>
    </div>
  )
}
