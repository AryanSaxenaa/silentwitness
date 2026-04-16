import { useEffect } from 'react'
import { X, Clock, Camera, Activity, Video } from 'lucide-react'
import { thumbnailUrl } from '../api'

function formatTime(isoStr) {
  if (!isoStr) return '--'
  try {
    return new Date(isoStr).toLocaleString()
  } catch {
    return isoStr
  }
}

export default function FrameModal({ frame, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!frame) return null

  const thumb = thumbnailUrl(frame.thumbnail_path)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Camera size={15} className="text-brand-500" />
            <span className="font-medium">{frame.camera_id}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400">{frame.video_file}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-surface-600 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Image */}
        <div className="aspect-video bg-surface-900 flex items-center justify-center">
          {thumb ? (
            <img
              src={thumb}
              alt="Selected frame"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-gray-600 flex flex-col items-center gap-2">
              <Camera size={40} />
              <span className="text-sm">No thumbnail available</span>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Match score</div>
            <div className="font-medium text-emerald-400">
              {Math.round((frame.score || 0) * 100)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Timestamp</div>
            <div className="font-mono text-gray-300">{frame.timestamp_sec}s</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Motion activity</div>
            <div className="text-gray-300">{Math.round((frame.motion_score || 0) * 100)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Recorded at</div>
            <div className="text-gray-300 text-xs">{formatTime(frame.absolute_time)}</div>
          </div>
        </div>

        {/* Footer tip */}
        <div className="px-6 py-3 bg-surface-900/50 border-t border-white/5 text-xs text-gray-600">
          Jump to timestamp <span className="font-mono text-gray-400">{frame.timestamp_sec}s</span> in{' '}
          <span className="text-gray-400">{frame.video_file}</span> to see the full context.
        </div>
      </div>
    </div>
  )
}
