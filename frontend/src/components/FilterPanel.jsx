import { useState, useEffect } from 'react'
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { getCameras } from '../api'

export default function FilterPanel({ filters, onChange }) {
  const [open, setOpen] = useState(false)
  const [cameras, setCameras] = useState([])

  useEffect(() => {
    getCameras().then((d) => setCameras(d.cameras || [])).catch(() => {})
  }, [])

  const activeCount = Object.values(filters).filter((v) => v !== null && v !== '' && v !== undefined).length

  const update = (key, value) => {
    onChange({ ...filters, [key]: value || null })
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300
                   hover:text-white transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} />
          <span className="font-medium">Filters</span>
          {activeCount > 0 && (
            <span className="badge bg-brand-500/20 text-brand-500">
              {activeCount} active
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-4">
          {/* Camera */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Camera</label>
            <select
              value={filters.cameraId || ''}
              onChange={(e) => update('cameraId', e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All cameras</option>
              {cameras.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Date</label>
            <input
              type="date"
              value={filters.date || ''}
              onChange={(e) => update('date', e.target.value)}
              className="input-field text-sm py-2"
            />
          </div>

          {/* Time range */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">From hour</label>
            <input
              type="number"
              min={0}
              max={23}
              placeholder="0"
              value={filters.hourStart ?? ''}
              onChange={(e) => update('hourStart', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field text-sm py-2"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">To hour</label>
            <input
              type="number"
              min={0}
              max={23}
              placeholder="23"
              value={filters.hourEnd ?? ''}
              onChange={(e) => update('hourEnd', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field text-sm py-2"
            />
          </div>

          {/* Motion score */}
          <div className="col-span-2 md:col-span-4">
            <label className="block text-xs text-gray-500 mb-1.5">
              Minimum motion activity: {filters.minMotionScore ? `${Math.round(filters.minMotionScore * 100)}%` : 'any'}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={filters.minMotionScore ?? 0}
              onChange={(e) => update('minMotionScore', parseFloat(e.target.value) || null)}
              className="w-full accent-brand-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>Any activity</span>
              <span>High motion only</span>
            </div>
          </div>

          {/* Reset */}
          {activeCount > 0 && (
            <div className="col-span-2 md:col-span-4">
              <button
                onClick={() => onChange({ cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null })}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
