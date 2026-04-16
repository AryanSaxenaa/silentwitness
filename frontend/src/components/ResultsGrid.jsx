import { useState } from 'react'
import { Clock, Camera, ChevronDown, ChevronUp, Play, ScanSearch, Layers, Activity } from 'lucide-react'
import { thumbnailUrl } from '../api'

function fmt(isoStr) {
  if (!isoStr) return '--'
  try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  catch { return isoStr }
}

function ScorePill({ score }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-amber' : 'badge-gray'
  return <span className={`badge ${color} font-mono`}>{pct}%</span>
}

/* ── Bento event card ── */
function EventCard({ event, onFrameClick, onSimilar }) {
  const [expanded, setExpanded] = useState(false)
  const best = event.frames?.[0]
  const thumb = thumbnailUrl(event.thumbnail_path)
  const durationLabel = event.duration_sec < 60
    ? `${event.duration_sec}s`
    : `${Math.floor(event.duration_sec / 60)}m ${event.duration_sec % 60}s`

  return (
    <div
      className="card-accent animate-fade-up"
      style={{ borderRadius: '14px', overflow: 'hidden' }}
    >
      <div className="flex gap-0" style={{ minHeight: '140px' }}>

        {/* Thumbnail — fixed left column */}
        <div
          className="relative flex-shrink-0 cursor-pointer group"
          style={{ width: '200px' }}
          onClick={() => best && onFrameClick({ ...best, camera_id: event.camera_id, video_file: event.video_file })}
        >
          {thumb
            ? <img src={thumb} alt="" className="w-full h-full object-cover" style={{ display: 'block' }} loading="lazy" />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                <Camera size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
          }
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)' }}>
              <Play size={16} style={{ color: '#080C14', marginLeft: '2px' }} fill="#080C14" />
            </div>
          </div>
          {/* Score badge */}
          <div className="absolute top-2 left-2">
            <ScorePill score={event.best_score} />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            {/* Camera + time */}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Camera size={12} style={{ color: 'var(--accent)' }} />
                <span className="font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {event.camera_id}
                </span>
              </div>
              <span className="badge badge-gray font-mono">
                <Layers size={9} /> {event.frame_count} frames
              </span>
              <span className="badge badge-gray font-mono">{durationLabel}</span>
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Clock size={12} />
              <span>{fmt(event.start_time)}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span>{fmt(event.end_time)}</span>
            </div>

            {/* Video filename */}
            <div className="font-mono truncate" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {event.video_file}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-3">
            {onSimilar && best && (
              <button
                onClick={() => onSimilar(best.frame_id)}
                className="btn-ghost"
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                <ScanSearch size={12} /> Find similar
              </button>
            )}
            {event.frame_count > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="btn-ghost"
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Collapse' : `All ${event.frame_count} frames`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded frame strip */}
      {expanded && (
        <div
          className="grid gap-1.5 p-3 animate-fade-up"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
          }}
        >
          {event.frames.map((f) => (
            <div
              key={f.frame_id}
              onClick={() => onFrameClick({ ...f, camera_id: event.camera_id, video_file: event.video_file })}
              className="relative cursor-pointer group"
              style={{ aspectRatio: '16/9', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-card)' }}
            >
              {thumbnailUrl(f.thumbnail_path)
                ? <img src={thumbnailUrl(f.thumbnail_path)} className="w-full h-full object-cover" loading="lazy" alt="" />
                : <div className="w-full h-full flex items-center justify-center"><Camera size={12} style={{ color: 'var(--text-muted)' }} /></div>
              }
              <div
                className="absolute bottom-0 inset-x-0 text-center font-mono"
                style={{ background: 'rgba(0,0,0,0.7)', fontSize: '9px', padding: '2px 0', color: '#93C5FD' }}
              >
                {Math.round(f.score * 100)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Bento frame card (grid view) ── */
function FrameCard({ frame, onClick, onSimilar }) {
  const thumb = thumbnailUrl(frame.thumbnail_path)

  return (
    <div
      className="card group cursor-pointer animate-fade-up"
      style={{ borderRadius: '12px', overflow: 'hidden' }}
      onClick={() => onClick(frame)}
    >
      {/* Thumbnail */}
      <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--bg-subtle)' }}>
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" alt="" />
          : <div className="w-full h-full flex items-center justify-center"><Camera size={24} style={{ color: 'var(--text-muted)' }} /></div>
        }
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <Play size={20} fill="white" style={{ color: 'white' }} />
        </div>
        <div className="absolute top-2 left-2"><ScorePill score={frame.score} /></div>
      </div>

      {/* Meta */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>{frame.camera_id}</span>
          <span className="badge badge-gray font-mono" style={{ fontSize: '10px' }}>
            <Activity size={9} /> {Math.round(frame.motion_score * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          <Clock size={11} />
          <span>{fmt(frame.absolute_time)}</span>
        </div>
        {onSimilar && (
          <button
            onClick={(e) => { e.stopPropagation(); onSimilar(frame.frame_id) }}
            className="btn-ghost w-full justify-center"
            style={{ padding: '5px 0', fontSize: '11px' }}
          >
            <ScanSearch size={11} /> Find similar
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Stats strip (supermemory style) ── */
function StatsStrip({ totalResults, totalEvents, query }) {
  return (
    <div className="flex items-center gap-8 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div>
        <div className="stat-number">{totalResults}</div>
        <div className="section-label mt-1">frames matched</div>
      </div>
      {totalEvents > 0 && (
        <div>
          <div className="stat-number">{totalEvents}</div>
          <div className="section-label mt-1">events detected</div>
        </div>
      )}
      {query && (
        <div className="ml-auto">
          <div className="font-mono text-sm" style={{ color: 'var(--accent)' }}>"{query}"</div>
          <div className="section-label mt-1">search query</div>
        </div>
      )}
    </div>
  )
}

export default function ResultsGrid({ results, viewMode = 'events', onFrameSelect, onSimilaritySearch }) {
  if (!results) return null
  const { total_results, total_events, events, frames, query } = results

  if (total_results === 0) {
    return (
      <div className="text-center py-20 animate-fade-up">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          <Camera size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="subheadline mb-2" style={{ fontSize: '20px' }}>No results found</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Try a different description or broaden your filters
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      <StatsStrip totalResults={total_results} totalEvents={total_events} query={query} />

      <div className="mt-5">
        {viewMode === 'events' && events?.length > 0 && (
          <div className="flex flex-col gap-3 stagger">
            {events.map((event) => (
              <EventCard
                key={event.event_id}
                event={event}
                onFrameClick={onFrameSelect}
                onSimilar={onSimilaritySearch}
              />
            ))}
          </div>
        )}

        {viewMode === 'frames' && frames?.length > 0 && (
          <div className="grid gap-3 stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {frames.map((frame) => (
              <FrameCard
                key={frame.frame_id}
                frame={frame}
                onClick={onFrameSelect}
                onSimilar={onSimilaritySearch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
