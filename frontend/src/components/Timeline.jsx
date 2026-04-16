import { useEffect, useState, useRef } from 'react'
import { Activity, Camera, ChevronDown, ChevronUp } from 'lucide-react'
import axios from 'axios'
import { thumbnailUrl } from '../api'

const API_BASE = import.meta.env.VITE_API_URL || ''

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
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (!data && !loading) return // only fetch when explicitly requested
  }, [])

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ bucket_minutes: 5 })
      if (cameraId) params.append('camera_id', cameraId)
      if (date) params.append('date', date)
      const { data: d } = await axios.get(`${API_BASE}/api/timeline?${params}`)
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
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
        <Activity size={14} className="animate-pulse" />
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
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300
                   hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-brand-500" />
          <span className="font-medium">Activity Timeline</span>
          <span className="badge bg-surface-600 text-gray-400">
            {data.total_buckets} time windows
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
          {Object.entries(byDate).map(([dateStr, buckets]) => (
            <div key={dateStr}>
              <div className="text-xs text-gray-500 mb-2">{dateStr}</div>

              {/* Heatmap bar */}
              <div className="flex items-end gap-0.5 h-16 overflow-x-auto pb-1">
                {buckets.map((bucket) => {
                  const heightPct = Math.max(4, (bucket.count / maxCount) * 100)
                  const isHot = bucket.max_motion > 0.3
                  const isHovered = hoveredBucket?.time === bucket.time

                  return (
                    <div
                      key={bucket.time}
                      className="relative flex-shrink-0 group"
                      style={{ width: '14px' }}
                      onMouseEnter={() => setHoveredBucket(bucket)}
                      onMouseLeave={() => setHoveredBucket(null)}
                      onClick={() => onBucketClick?.(bucket)}
                    >
                      {/* Bar */}
                      <div
                        className={`
                          w-full rounded-sm cursor-pointer transition-all duration-150
                          ${isHovered ? 'ring-1 ring-brand-500' : ''}
                          ${isHot
                            ? 'bg-red-500/70 hover:bg-red-400'
                            : bucket.count > maxCount * 0.5
                            ? 'bg-amber-500/60 hover:bg-amber-400'
                            : 'bg-brand-500/40 hover:bg-brand-500/70'
                          }
                        `}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  )
                })}
              </div>

              {/* X-axis labels — show every hour */}
              <div className="flex items-center mt-1 text-[9px] text-gray-600 relative" style={{ height: '12px' }}>
                {buckets
                  .filter((_, i) => i % 12 === 0) // every 12 buckets = 1 hour at 5min intervals
                  .map((bucket, i) => (
                    <div
                      key={bucket.time}
                      className="absolute"
                      style={{ left: `${(buckets.indexOf(bucket) / buckets.length) * 100}%` }}
                    >
                      {formatBucketTime(bucket.time)}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-brand-500/40" />
              <span>Low activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-500/60" />
              <span>Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500/70" />
              <span>High motion</span>
            </div>
          </div>

          {/* Tooltip */}
          {hoveredBucket && (
            <div className="glass rounded-lg p-3 border border-white/10 text-xs space-y-1">
              <div className="text-gray-300 font-medium">{hoveredBucket.time}</div>
              <div className="text-gray-500">
                {hoveredBucket.count} frame{hoveredBucket.count !== 1 ? 's' : ''} indexed
                · max motion: {Math.round(hoveredBucket.max_motion * 100)}%
              </div>
              {hoveredBucket.frames?.length > 0 && (
                <div className="flex gap-1.5 pt-1">
                  {hoveredBucket.frames.map((f) => (
                    <div
                      key={f.frame_id}
                      className="w-16 aspect-video bg-surface-700 rounded overflow-hidden"
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
                    className="text-brand-400 hover:text-brand-300 self-center ml-1"
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
