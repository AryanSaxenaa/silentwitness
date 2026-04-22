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
      style={{ borderRadius: '24px', overflow: 'hidden' }}
    >
      <div className="flex gap-0" style={{ minHeight: '182px' }}>

        <div
          className="relative flex-shrink-0 cursor-pointer group"
          style={{ width: '250px' }}
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
          <div className="absolute top-3 left-3">
            <ScorePill score={event.best_score} />
          </div>
          <div
            className="absolute bottom-0 inset-x-0"
            style={{
              padding: '14px 14px 12px',
              background: 'linear-gradient(180deg, transparent, rgba(8,7,5,0.9))',
            }}
          >
            <div className="section-label" style={{ color: 'rgba(255,255,255,0.65)' }}>top frame</div>
            <div style={{ color: 'white', fontWeight: 600, marginTop: '2px' }}>{fmt(event.start_time)} to {fmt(event.end_time)}</div>
          </div>
        </div>

        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
          <div>
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

            <div
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--display)',
                fontSize: '28px',
                lineHeight: 1.02,
                letterSpacing: '-0.05em',
                maxWidth: '540px',
                marginBottom: '10px',
              }}
            >
              {event.frame_count > 1 ? 'Matched activity window' : 'Matched frame'}
            </div>

            <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Clock size={12} />
              <span>{fmt(event.start_time)}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span>{fmt(event.end_time)}</span>
            </div>

            <div className="font-mono truncate" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {event.video_file}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {best && (
              <button
                onClick={() => onFrameClick({ ...best, camera_id: event.camera_id, video_file: event.video_file })}
                className="btn-primary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                <Play size={12} /> Open frame
              </button>
            )}
            {onSimilar && best && (
              <button
                onClick={() => onSimilar(best.frame_id)}
                className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: '12px' }}
              >
                <ScanSearch size={12} /> Find similar
              </button>
            )}
            {event.frame_count > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: '12px' }}
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
            borderTop: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
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
      style={{ borderRadius: '18px', overflow: 'hidden' }}
      onClick={() => onClick(frame)}
    >
      <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--bg-subtle)' }}>
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" alt="" />
          : <div className="w-full h-full flex items-center justify-center"><Camera size={24} style={{ color: 'var(--text-muted)' }} /></div>
        }
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <Play size={20} fill="white" style={{ color: 'white' }} />
        </div>
        <div className="absolute top-3 left-3"><ScorePill score={frame.score} /></div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--accent)' }}>{frame.camera_id}</span>
          <span className="badge badge-gray font-mono" style={{ fontSize: '10px' }}>
            <Activity size={9} /> {Math.round(frame.motion_score * 100)}%
          </span>
        </div>
        <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--display)', fontSize: '21px', letterSpacing: '-0.04em', lineHeight: 1.02, marginBottom: '8px' }}>
          Frame hit at {fmt(frame.absolute_time)}
        </div>
        <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          <Clock size={11} />
          <span>{fmt(frame.absolute_time)}</span>
        </div>
        <div className="section-label" style={{ marginBottom: '10px' }}>Click card to inspect the frame</div>
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
    <div
      className="surface-grid py-4 border-b"
      style={{ borderColor: 'var(--border)', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
    >
      <div className="col-span-6 md:col-span-3 xl:col-span-2">
        <div className="stat-number">{totalResults}</div>
        <div className="section-label mt-1">frames matched</div>
      </div>
      {totalEvents > 0 && (
        <div className="col-span-6 md:col-span-3 xl:col-span-2">
          <div className="stat-number">{totalEvents}</div>
          <div className="section-label mt-1">clustered events</div>
        </div>
      )}
      {query && (
        <div className="col-span-12 md:col-span-6 xl:col-span-8">
          <div className="section-label">current query</div>
          <div
            style={{
              color: 'var(--accent-soft)',
              fontFamily: 'var(--display)',
              fontSize: '28px',
              lineHeight: 1.02,
              letterSpacing: '-0.05em',
              marginTop: '6px',
            }}
          >
            {query}
          </div>
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
      <div className="text-center py-20 animate-fade-up card-accent" style={{ padding: '48px 24px' }}>
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
          <div className="grid gap-4 stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
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
