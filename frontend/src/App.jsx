import { useState } from 'react'
import { Eye, LayoutGrid, List, Settings, X } from 'lucide-react'
import SearchBar from './components/SearchBar'
import FilterPanel from './components/FilterPanel'
import ResultsGrid from './components/ResultsGrid'
import FrameModal from './components/FrameModal'
import IndexPanel from './components/IndexPanel'
import StatusBar from './components/StatusBar'
import { searchFootage } from './api'

export default function App() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('events') // 'events' | 'frames'
  const [selectedFrame, setSelectedFrame] = useState(null)
  const [showIndexPanel, setShowIndexPanel] = useState(false)
  const [filters, setFilters] = useState({
    cameraId: null,
    date: null,
    hourStart: null,
    hourEnd: null,
    minMotionScore: null,
  })

  const handleSearch = async (query) => {
    setLoading(true)
    setError(null)
    try {
      const data = await searchFootage({
        query,
        ...filters,
        groupIntoEvents: viewMode === 'events',
      })
      setResults(data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Search failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30
                              flex items-center justify-center">
                <Eye size={16} className="text-brand-500" />
              </div>
              <div>
                <div className="font-bold text-white tracking-tight leading-none">SilentWitness</div>
                <div className="text-[10px] text-gray-500 leading-none mt-0.5">
                  Semantic Security Search
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center glass rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('events')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'events'
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <List size={13} /> Events
                </button>
                <button
                  onClick={() => setViewMode('frames')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'frames'
                      ? 'bg-brand-500 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <LayoutGrid size={13} /> Frames
                </button>
              </div>

              {/* Index panel toggle */}
              <button
                onClick={() => setShowIndexPanel(!showIndexPanel)}
                className={`btn-secondary flex items-center gap-1.5 text-xs py-1.5 ${
                  showIndexPanel ? 'border-brand-500/50 text-brand-400' : ''
                }`}
              >
                <Settings size={13} />
                Index footage
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-2">
            <StatusBar />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          {/* Left: search + results */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Hero text (only when no results) */}
            {!results && !loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20
                                flex items-center justify-center mx-auto mb-4">
                  <Eye size={28} className="text-brand-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Find anything in your footage
                </h1>
                <p className="text-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
                  Describe what you're looking for in plain English. SilentWitness uses CLIP semantic
                  search to find the exact frames — no manual scrubbing, no annotations, no cloud.
                </p>
              </div>
            )}

            {/* Search bar */}
            <SearchBar onSearch={handleSearch} loading={loading} />

            {/* Filters */}
            <FilterPanel filters={filters} onChange={setFilters} />

            {/* Error */}
            {error && (
              <div className="glass rounded-xl px-4 py-3 border border-red-500/20 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-xl p-4 flex gap-4 animate-pulse">
                    <div className="w-40 aspect-video bg-surface-700 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-2">
                      <div className="h-3 bg-surface-700 rounded w-1/3" />
                      <div className="h-3 bg-surface-700 rounded w-1/2" />
                      <div className="h-3 bg-surface-700 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {!loading && results && (
              <ResultsGrid
                results={results}
                viewMode={viewMode}
                onFrameSelect={setSelectedFrame}
              />
            )}
          </div>

          {/* Right: index panel (collapsible) */}
          {showIndexPanel && (
            <div className="w-72 flex-shrink-0">
              <div className="glass rounded-xl p-4 sticky top-24">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Index Footage</h2>
                  <button
                    onClick={() => setShowIndexPanel(false)}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
                <IndexPanel />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Frame detail modal */}
      {selectedFrame && (
        <FrameModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
      )}
    </div>
  )
}
