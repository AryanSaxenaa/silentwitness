import { useState } from 'react'
import { Clock, Camera, Activity, ChevronDown, ChevronUp, Play, Layers } from 'lucide-react'
import { thumbnailUrl } from '../api'

function formatTime(isoStr) {
  if (!isoStr) return '--'
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return isoStr
  }
}

function formatDuration(sec) {
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'text-emerald-400 bg-emerald-400/10' :
                pct >= 60 ? 'text-amber-400 bg-amber-400/10' :
                            'text-gray-400 bg-gray-400/10'
  return (
    <span className={`badge ${color} font-mono`}>
      {pct}% match
    </span>
  )
}

function MotionBadge({ score }) {
  const pct = Math.round(score * 100)
  return (
    <span className="badge bg-surface-600 text-gray-400 font-mono">
      <Activity size={9} />
      {pct}% motion
    </span>
  )
}

function FrameCard({ frame, onClick }) {
  const thumb = thumbnailUrl(frame.thumbnail_path)

  return (
    <div
      onClick={() => onClick(frame)}
      className="card cursor-pointer hover:scale-[1.02] hover:border-brand-500/30 group relative overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-700 rounded-lg overflow-hidden mb-3 relative">
        {thumb ? (
          <img
            src={thumb}
            alt={`Frame at ${frame.timestamp_sec}s`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Camera size={32} />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <Play size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
        </div>
        {/* Score badge overlay */}
        <div className="absolute top-2 right-2">
          <ScoreBadge score={frame.score} />
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Camera size={11} />
            <span>{frame.camera_id}</span>
          </div>
          <MotionBadge score={frame.motion_score} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock size={11} />
          <span>{formatTime(frame.absolute_time)}</span>
          <span className="text-gray-600">·</span>
          <span className="font-mono">{frame.timestamp_sec}s</span>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event, onFrameClick }) {
  const [expanded, setExpanded] = useState(false)
  const bestFrame = event.frames?.[0]
  const thumb = thumbnailUrl(event.thumbnail_path)

  return (
    <div className="card border border-white/5 hover:border-brand-500/20 transition-all">
      {/* Event header */}
      <div className="flex gap-4">
        {/* Best thumbnail */}
        <div
          className="w-40 flex-shrink-0 aspect-video bg-surface-700 rounded-lg overflow-hidden cursor-pointer relative group"
          onClick={() => bestFrame && onFrameClick(bestFrame)}
        >
          {thumb ? (
            <img src={thumb} alt="Event thumbnail" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <Camera size={24} />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <Play size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="white" />
          </div>
        </div>

        {/* Event info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ScoreBadge score={event.best_score} />
              <span className="badge bg-surface-600 text-gray-400">
                <Layers size={9} />
                {event.frame_count} frames
              </span>
              <span className="badge bg-surface-600 text-gray-400">
                {formatDuration(event.duration_sec)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-300">
              <Camera size={13} className="text-gray-500" />
              <span>{event.camera_id}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={11} />
              <span>{formatTime(event.start_time)}</span>
              <span>→</span>
              <span>{formatTime(event.end_time)}</span>
            </div>
            <div className="text-xs text-gray-600 font-mono">{event.video_file}</div>
          </div>
        </div>
      </div>

      {/* Expand frames */}
      {event.frame_count > 1 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-gray-500
                       hover:text-gray-300 transition-colors py-1.5 border-t border-white/5"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide' : 'Show'} all {event.frame_count} frames
          </button>

          {expanded && (
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {event.frames.map((frame) => (
                <div
                  key={frame.frame_id}
                  onClick={() => onFrameClick(frame)}
                  className="aspect-video bg-surface-700 rounded overflow-hidden cursor-pointer
                             hover:ring-1 hover:ring-brand-500/50 relative group"
                >
                  {thumbnailUrl(frame.thumbnail_path) ? (
                    <img
                      src={thumbnailUrl(frame.thumbnail_path)}
                      alt={`${frame.timestamp_sec}s`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                      <Camera size={12} />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center text-[10px] text-gray-300 py-0.5">
                    {Math.round(frame.score * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ResultsGrid({ results, viewMode = 'events', onFrameSelect }) {
  if (!results) return null

  const { total_results, total_events, events, frames, query } = results

  if (total_results === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Camera size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-lg font-medium text-gray-400">No results found</p>
        <p className="text-sm mt-1">Try a different description or broaden your filters</p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400">
          Found <span className="text-white font-medium">{total_results}</span> frames
          {total_events > 0 && (
            <> grouped into <span className="text-white font-medium">{total_events}</span> events</>
          )}
          {query && <> for <span className="text-brand-500">"{query}"</span></>}
        </div>
      </div>

      {/* Events view */}
      {viewMode === 'events' && events?.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.event_id} event={event} onFrameClick={onFrameSelect} />
          ))}
        </div>
      )}

      {/* Frames grid view */}
      {viewMode === 'frames' && frames?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {frames.map((frame) => (
            <FrameCard key={frame.frame_id} frame={frame} onClick={onFrameSelect} />
          ))}
        </div>
      )}
    </div>
  )
}
