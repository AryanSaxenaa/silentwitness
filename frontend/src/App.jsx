import { useState, useEffect } from 'react'
import { Eye, LayoutGrid, List, Settings, X, Radio } from 'lucide-react'
import SearchBar from './components/SearchBar'
import FilterPanel from './components/FilterPanel'
import ResultsGrid from './components/ResultsGrid'
import FrameModal from './components/FrameModal'
import IndexPanel from './components/IndexPanel'
import StatusBar from './components/StatusBar'
import Timeline from './components/Timeline'
import LiveFeedPanel from './components/LiveFeedPanel'
import { searchFootage } from './api'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

/* ── Matrix strip background (supermemory number-art) ── */
function MatrixStrip() {
  const chars = '0 1 4 9 2 7 3 8 5 6 '.repeat(200)
  return (
    <div
      className="matrix-strip absolute inset-0 opacity-40 select-none pointer-events-none"
      style={{ fontSize: '11px', lineHeight: '1.8', overflow: 'hidden', letterSpacing: '0.15em' }}
      aria-hidden
    >
      {chars}
    </div>
  )
}

/* ── Section label with bracket notation ── */
function SectionTag({ index, total, label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="section-label">[ {index} / {total} ]</span>
      {label && <span className="section-label">{label}</span>}
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}

/* ── Loading skeleton ── */
function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex gap-0 overflow-hidden animate-pulse"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', height: '140px' }}
        >
          <div style={{ width: '200px', background: 'var(--bg-subtle)', flexShrink: 0 }} />
          <div className="flex-1 p-4 flex flex-col gap-3 justify-center">
            <div style={{ height: '12px', width: '40%', background: 'var(--bg-subtle)', borderRadius: '4px' }} />
            <div style={{ height: '10px', width: '60%', background: 'var(--bg-subtle)', borderRadius: '4px' }} />
            <div style={{ height: '10px', width: '30%', background: 'var(--bg-subtle)', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('events')
  const [selectedFrame, setSelectedFrame] = useState(null)
  const [showIndexPanel, setShowIndexPanel] = useState(false)
  const [showLivePanel, setShowLivePanel] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [filters, setFilters] = useState({
    cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null,
  })

  const handleSearch = async (query) => {
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const data = await searchFootage({ query, ...filters, groupIntoEvents: viewMode === 'events' })
      setResults(data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Search failed — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceResult = (data) => {
    setResults(data)
    setHasSearched(true)
  }

  const handleSimilaritySearch = async (frameId) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post(`${API_BASE}/api/search/similar`, { frame_id: frameId, limit: 20 })
      setResults({ ...data, query: 'visually similar frames' })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Similarity search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTimelineBucketClick = (bucket) => {
    const [dateStr, timeStr] = bucket.time.split('T')
    const hour = parseInt(timeStr.split(':')[0])
    setFilters((f) => ({ ...f, date: dateStr, hourStart: hour, hourEnd: hour + 1 }))
    handleSearch(`activity at ${timeStr}`)
  }

  const TOTAL_SECTIONS = showIndexPanel || showLivePanel ? 3 : 2

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* ── Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8,12,20,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          {/* Top row */}
          <div className="flex items-center justify-between" style={{ height: '56px' }}>
            {/* Wordmark */}
            <div className="flex items-center gap-3">
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: 'var(--accent-dim)',
                border: '1px solid rgba(59,130,246,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Eye size={15} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                  SilentWitness
                </div>
                <div className="section-label" style={{ marginTop: '1px' }}>semantic security search</div>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '9px', padding: '3px' }}>
                {[
                  { id: 'events', icon: <List size={13} />, label: 'Events' },
                  { id: 'frames', icon: <LayoutGrid size={13} />, label: 'Frames' },
                ].map(({ id, icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setViewMode(id)}
                    className="btn-ghost"
                    style={{
                      padding: '5px 12px', fontSize: '12px', borderRadius: '6px',
                      ...(viewMode === id
                        ? { background: 'var(--accent)', color: 'white', borderColor: 'transparent' }
                        : { borderColor: 'transparent' }
                      )
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Live */}
              <button
                onClick={() => { setShowLivePanel(!showLivePanel); setShowIndexPanel(false) }}
                className="btn-ghost"
                style={showLivePanel ? { color: '#FCA5A5', borderColor: '#EF4444', background: 'rgba(239,68,68,.08)' } : {}}
              >
                <Radio size={13} />
                Live
                {showLivePanel && <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#EF4444', marginLeft: '2px' }} />}
              </button>

              {/* Index */}
              <button
                onClick={() => { setShowIndexPanel(!showIndexPanel); setShowLivePanel(false) }}
                className="btn-ghost"
                style={showIndexPanel ? { color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-dim)' } : {}}
              >
                <Settings size={13} />
                Index
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div style={{ paddingBottom: '10px' }}>
            <StatusBar />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div className="flex gap-6">

          {/* Left content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ── Hero / Search section ── */}
            <div style={{ padding: '48px 0 32px' }}>
              <SectionTag index={1} total={TOTAL_SECTIONS} label="search" />

              {/* Hero headline — supermemory style large bold */}
              {!hasSearched && (
                <div className="mb-8 animate-fade-up">
                  <h1 className="headline mb-4" style={{ maxWidth: '640px' }}>
                    Your footage never<br />leaves the building
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '520px', lineHeight: '1.65' }}>
                    Search hours of security video in plain English.
                    No scrubbing. No annotations. No cloud.
                    Entirely offline — powered by Actian VectorAI DB.
                  </p>

                  {/* Stats strip — 3 numbers */}
                  <div className="flex items-center gap-10 mt-8 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      { num: '<15ms', label: 'query latency' },
                      { num: '100%', label: 'offline' },
                      { num: '0', label: 'bytes sent' },
                    ].map(({ num, label }) => (
                      <div key={label}>
                        <div className="stat-number">{num}</div>
                        <div className="section-label mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <SearchBar onSearch={handleSearch} loading={loading} onVoiceResult={handleVoiceResult} />
            </div>

            {/* ── Filters ── */}
            <div style={{ marginBottom: '20px' }}>
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>

            {/* ── Error ── */}
            {error && (
              <div
                className="animate-fade-up mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#EF4444', flexShrink: 0 }} />
                <p style={{ color: '#FCA5A5', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            {/* ── Results section ── */}
            {hasSearched && (
              <div style={{ paddingBottom: '48px' }}>
                <SectionTag index={2} total={TOTAL_SECTIONS} label="results" />

                {/* Timeline */}
                {!loading && (
                  <div className="mb-4">
                    <Timeline cameraId={filters.cameraId} date={filters.date} onBucketClick={handleTimelineBucketClick} />
                  </div>
                )}

                {loading ? <Skeleton /> : <ResultsGrid results={results} viewMode={viewMode} onFrameSelect={setSelectedFrame} onSimilaritySearch={handleSimilaritySearch} />}
              </div>
            )}
          </div>

          {/* Right panel */}
          {(showIndexPanel || showLivePanel) && (
            <div style={{ width: '300px', flexShrink: 0, paddingTop: '48px' }}>
              <SectionTag index={3} total={TOTAL_SECTIONS} label={showIndexPanel ? 'index' : 'live'} />
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '20px',
                  position: 'sticky',
                  top: '96px',
                }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="subheadline" style={{ fontSize: '16px' }}>
                    {showIndexPanel ? 'Index Footage' : 'Live Feed'}
                  </span>
                  <button
                    className="btn-ghost"
                    style={{ padding: '4px 8px' }}
                    onClick={() => { setShowIndexPanel(false); setShowLivePanel(false) }}
                  >
                    <X size={14} />
                  </button>
                </div>
                {showIndexPanel ? <IndexPanel /> : <LiveFeedPanel />}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Matrix CTA strip (supermemory final section style) ── */}
      {!hasSearched && (
        <div
          className="relative overflow-hidden"
          style={{
            borderTop: '1px solid var(--border)',
            padding: '60px 0',
            background: 'linear-gradient(180deg, var(--bg-base) 0%, #0A0F1E 100%)',
          }}
        >
          <MatrixStrip />
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <p className="section-label mb-3">[ built with ]</p>
                <div className="flex flex-wrap gap-2">
                  {['Actian VectorAI DB', 'CLIP ViT-B/32', 'OpenCV', 'Whisper', 'FastAPI', 'React'].map((t) => (
                    <span key={t} className="badge badge-gray font-mono">{t}</span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="section-label mb-2">Actian VectorAI DB Build Challenge · April 2026</p>
                <a
                  href="https://github.com/AryanSaxenaa/silentwitness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                >
                  View on GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Frame modal */}
      {selectedFrame && <FrameModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />}
    </div>
  )
}
