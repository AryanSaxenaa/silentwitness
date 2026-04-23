import { useState, useEffect } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { getCameras } from '../api'
import Tooltip from './Tooltip'

export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(true)
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    getCameras().then((d) => setCameras(d.cameras || [])).catch(() => {})
  }, [])

  const update = (key, value) => onChange({ ...filters, [key]: value || null })

  const activeFilters = Object.entries(filters).filter(([, v]) => v !== null && v !== '' && v !== undefined)
  const activeCount = activeFilters.length

  const clearAll = () => onChange({ cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null, ocrText: null })

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <Tooltip content={open ? 'Collapse the filter controls' : 'Expand the filter controls'}>
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
        </Tooltip>

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

        {activeCount > 0 && (
          <Tooltip content="Remove every active filter">
            <button onClick={clearAll} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              Clear all
            </button>
          </Tooltip>
        )}
      </div>

      {open && (
        <div
          className="mt-3 p-5 rounded-[16px] space-y-4 animate-fade-up"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
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
            <label className="section-label block mb-2">Text in frame</label>
            <input
              type="text"
              placeholder="receipt, exit, aisle 4..."
              value={filters.ocrText || ''}
              onChange={(e) => update('ocrText', e.target.value)}
              className="input-field"
              style={{ fontSize: '13px' }}
            />
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div>
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
