import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { getTimeline, thumbnailUrl } from '../api'

function formatBucketTime(timeStr) {
  // "2026-04-13T10:05" → "10:05"
  return timeStr?.split('T')[1] || timeStr
}

function formatBucketDate(timeStr) {
  return timeStr?.split('T')[0] || ''
}

export default function Timeline({ cameraId, date, onBucketClick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const [hoveredBucket, setHoveredBucket] = useState(null)

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const d = await getTimeline({ cameraId, date, bucketMinutes: 5 })
      setData(d)
    } catch (e) {
      console.error('Timeline fetch failed', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
  }, [cameraId, date])

  if (!data && !loading) return null
  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm animate-pulse"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <Activity size={14} />
        Loading activity timeline...
      </div>
    )
  }
  if (!data || data.timeline.length === 0) return null

  const maxCount = Math.max(...data.timeline.map((b) => b.count), 1)

  // Group by date
  const byDate = data.timeline.reduce((acc, bucket) => {
    const d = formatBucketDate(bucket.time)
    if (!acc[d]) acc[d] = []
    acc[d].push(bucket)
    return acc
  }, {})

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(14px)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: 'var(--accent)' }} />
          <span className="font-medium text-sm">Activity Timeline</span>
          <span className="badge badge-gray">{data.total_buckets} windows</span>
        </div>
        {open
          ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        }
      </button>

      {open && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}
        >
          {Object.entries(byDate).map(([dateStr, buckets]) => (
            <div key={dateStr}>
              <div className="section-label mb-2">{dateStr}</div>
              <div
                className="timeline-track"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.max(buckets.length, 12)}, minmax(18px, 1fr))`,
                  alignItems: 'end',
                  gap: '6px',
                  minHeight: '92px',
                  padding: '12px 0 8px',
                }}
              >
                {buckets.map((bucket) => {
                  const heightPct = Math.max(18, (bucket.count / maxCount) * 100)
                  const isHot = bucket.max_motion > 0.3
                  const isMid = bucket.count > maxCount * 0.5
                  const isHovered = hoveredBucket?.time === bucket.time

                  let barBg = 'rgba(3,196,255,0.35)'
                  if (isHot) barBg = 'rgba(239,68,68,0.65)'
                  else if (isMid) barBg = 'rgba(253,90,27,0.55)'

                  let barHoverBg = 'rgba(3,196,255,0.6)'
                  if (isHot) barHoverBg = 'rgba(239,68,68,0.85)'
                  else if (isMid) barHoverBg = 'rgba(253,90,27,0.8)'

                  return (
                    <div
                      key={bucket.time}
                      className="relative cursor-pointer"
                      style={{ minWidth: '18px', height: '72px', display: 'flex', alignItems: 'end' }}
                      onMouseEnter={() => setHoveredBucket(bucket)}
                      onMouseLeave={() => setHoveredBucket(null)}
                      onClick={() => onBucketClick?.(bucket)}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          background: barBg,
                          borderRadius: '6px 6px 3px 3px',
                          outline: isHovered ? '1px solid var(--accent)' : 'none',
                          transition: 'background 100ms, transform 100ms',
                          boxShadow: isHovered ? '0 0 0 1px rgba(137,206,255,0.35)' : 'none',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = barHoverBg
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = barBg
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              <div
                className="flex items-center mt-1 relative"
                style={{ minHeight: '18px', color: 'var(--text-muted)', fontSize: '9px' }}
              >
                {buckets
                  .filter((_, i) => i === 0 || i === buckets.length - 1 || i % 6 === 0)
                  .map((bucket) => (
                    <div
                      key={bucket.time}
                      className="absolute"
                      style={{ left: `${(buckets.indexOf(bucket) / Math.max(buckets.length - 1, 1)) * 100}%`, transform: 'translateX(-50%)' }}
                    >
                      {formatBucketTime(bucket.time)}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 pt-1" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(3,196,255,0.35)' }} />
              <span>Low activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(253,90,27,0.55)' }} />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.65)' }} />
              <span>High motion</span>
            </div>
          </div>

          {hoveredBucket && (
            <div
              className="rounded-xl p-3 space-y-1"
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-hover)',
                fontSize: '12px',
              }}
            >
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{hoveredBucket.time}</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {hoveredBucket.count} frame{hoveredBucket.count !== 1 ? 's' : ''} indexed
                · max motion: {Math.round(hoveredBucket.max_motion * 100)}%
              </div>
              {hoveredBucket.frames?.length > 0 && (
                <div className="flex gap-1.5 pt-1 items-center">
                  {hoveredBucket.frames.map((f) => (
                    <div
                      key={f.frame_id}
                      className="rounded overflow-hidden flex-shrink-0"
                      style={{ width: '64px', aspectRatio: '16/9', background: 'var(--bg-card)' }}
                    >
                      {thumbnailUrl(f.thumbnail_path) && (
                        <img
                          src={thumbnailUrl(f.thumbnail_path)}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => onBucketClick?.(hoveredBucket)}
                    className="btn-ghost ml-1"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    Search this window →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
