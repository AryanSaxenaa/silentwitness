import { useState, useEffect } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { getCameras } from '../api'

export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(false)
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    getCameras().then((d) => setCameras(d.cameras || [])).catch(() => {})
  }, [])

  const update = (key, value) => onChange({ ...filters, [key]: value || null })

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  const activeCount = activeFilters.length

  const clearAll = () => onChange({ cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null })

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen(!open)}
          className="btn-ghost"
          style={open ? { color: '#16120e', borderColor: 'var(--accent)', background: 'var(--accent)' } : {}}
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeCount > 0 && (
            <span className="badge badge-blue" style={{ padding: '1px 6px', fontSize: '10px' }}>
              {activeCount}
            </span>
          )}
          <ChevronDown
            size={13}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
          />
        </button>

        {activeFilters.map(([key, val]) => (
          <span
            key={key}
            className="badge badge-blue flex items-center gap-1.5"
            style={{ padding: '4px 10px' }}
          >
            <span className="font-mono text-[10px] tracking-wider opacity-60">{key}</span>
            <span>{String(val)}</span>
            <button onClick={() => update(key, null)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
              <X size={10} />
            </button>
          </span>
        ))}

        {activeCount > 1 && (
          <button onClick={clearAll} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div
          className="mt-3 p-5 rounded-[16px] grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-4 animate-fade-up"
          style={{
            background: 'rgba(10, 16, 28, 0.42)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div>
            <label className="section-label block mb-2">Camera</label>
            <select
              value={filters.cameraId || ''}
              onChange={(e) => update('cameraId', e.target.value)}
              className="input-field"
              style={{ fontSize: '13px' }}
            >
              <option value="">All cameras</option>
              {cameras.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="section-label block mb-2">Date</label>
            <input
              type="date"
              value={filters.date || ''}
              onChange={(e) => update('date', e.target.value)}
              className="input-field"
              style={{ fontSize: '13px', colorScheme: 'dark' }}
            />
          </div>

          <div>
            <label className="section-label block mb-2">From hour</label>
            <input
              type="number" min={0} max={23} placeholder="0"
              value={filters.hourStart ?? ''}
              onChange={(e) => update('hourStart', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field"
              style={{ fontSize: '13px', fontFamily: 'var(--mono)' }}
            />
          </div>

          <div>
            <label className="section-label block mb-2">To hour</label>
            <input
              type="number" min={0} max={23} placeholder="23"
              value={filters.hourEnd ?? ''}
              onChange={(e) => update('hourEnd', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field"
              style={{ fontSize: '13px', fontFamily: 'var(--mono)' }}
            />
          </div>

          <div className="col-span-2 md:col-span-4">
            <div className="flex items-center justify-between mb-2">
              <label className="section-label">Min motion</label>
              <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
                {filters.minMotionScore ? `${Math.round(filters.minMotionScore * 100)}%` : 'Any'}
              </span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01}
              value={filters.minMotionScore ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                // parseFloat('0') || null would wrongly produce null — check explicitly
                update('minMotionScore', (isNaN(val) || val === 0) ? null : val)
              }}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex justify-between mt-1" style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--mono)' }}>
              <span>any activity</span>
              <span>high motion only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
