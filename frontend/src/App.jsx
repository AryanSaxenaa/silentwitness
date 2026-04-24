import { useEffect, useState } from 'react'
import {
  Cctv,
  LayoutGrid,
  List,
  Radio,
  Search,
  Filter,
  Shield,
  Database,
  Moon,
  Sun,
} from 'lucide-react'
import SearchBar from './components/SearchBar'
import FilterPanel from './components/FilterPanel'
import ResultsGrid from './components/ResultsGrid'
import FrameModal from './components/FrameModal'
import IndexPanel from './components/IndexPanel'
import StatusBar from './components/StatusBar'
import Timeline from './components/Timeline'
import LiveFeedPanel from './components/LiveFeedPanel'
import Tooltip from './components/Tooltip'
import { getStatus, searchFootage, searchSimilar } from './api'

function SectionTag({ label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="section-label">{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}

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

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function App() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [viewMode, setViewMode] = useState('events')
  const [selectedFrame, setSelectedFrame] = useState(null)
  const [activePanel, setActivePanel] = useState('index')
  const [hasSearched, setHasSearched] = useState(false)
  const [searchContext, setSearchContext] = useState({ activeCamera: null, sourceVideo: null })
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('silentwitness-theme') || 'light'
  })
  const [filters, setFilters] = useState({
    cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null, ocrText: null,
  })

  useEffect(() => {
    const fetchStatus = () => getStatus().then(setStatus).catch(() => setStatus(null))
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('silentwitness-theme', theme)
  }, [theme])

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
    setHasSearched(true)
    try {
      const data = await searchSimilar({ frameId, limit: 20, ...filters })
      setResults({ ...data, query: 'visually similar frames' })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Similarity search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTimelineBucketClick = (bucket) => {
    const [dateStr, timeStr] = bucket.time.split('T')
    const hour = parseInt(timeStr.split(':')[0], 10)
    const newFilters = { ...filters, date: dateStr, hourStart: hour, hourEnd: hour + 1 }
    setFilters(newFilters)
    setLoading(true)
    setError(null)
    setHasSearched(true)
    searchFootage({ query: `activity at ${timeStr}`, ...newFilters, groupIntoEvents: viewMode === 'events' })
      .then(setResults)
      .catch((err) => setError(err?.response?.data?.detail || 'Search failed — is the backend running?'))
      .finally(() => setLoading(false))
  }

  const indexedFrames = status?.stats?.total_frames ?? 0
  const indexedCameras = status?.cameras ?? []
  const dbConnected = status?.db_connected ?? false
  const retrievalSanity = status?.runtime_health?.retrieval_sanity
  const resultsSummary = viewMode === 'events'
    ? 'Group matched moments into event windows'
    : 'Review individual frame hits'
  const workflowSteps = [
    { title: '1. Add footage', copy: 'Place a clip in the footage folder or upload one from the operations panel.' },
    { title: '2. Index frames', copy: 'Run scan once so SilentWitness extracts motion-gated frames into Actian VectorAI DB.' },
    { title: '3. Search and pivot', copy: 'Search in plain language, refine with filters or OCR text, then pivot into visually similar moments.' },
  ]
  const isStreetCamera = (filters.cameraId || searchContext.activeCamera) === 'cam3'
  const suggestedQueries = isStreetCamera
    ? ['white van', 'ambulance', 'vehicle on road', 'street traffic', 'cars on street', 'emergency vehicle']
    : ['person entering store', 'person near shelves', 'person walking in the store', 'two people in frame', 'person at entrance', 'customer moving through aisle']
  const suggestionLabel = isStreetCamera
    ? 'Suggested prompts for the street clip'
    : 'Suggested prompts for current demo footage'

  const handleIndexedCamera = (job) => {
    const nextFilters = { ...filters }
    if (job.camera_id) nextFilters.cameraId = job.camera_id
    if (job.recording_start) {
      const dt = new Date(job.recording_start)
      if (!Number.isNaN(dt.getTime())) {
        nextFilters.date = dt.toISOString().slice(0, 10)
        nextFilters.hourStart = dt.getHours()
        nextFilters.hourEnd = Math.min(23, dt.getHours() + 1)
      }
    }
    setFilters(nextFilters)
    setSearchContext({ activeCamera: job.camera_id || null, sourceVideo: job.video || null })
  }

  return (
    <main className="app-shell">
      <header className="top-shell">
        <div className="top-shell__inner">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Cctv size={16} />
            </div>
            <div>
              <div className="brand-title">SilentWitness</div>
              <div className="brand-subtitle">search and review local security footage</div>
            </div>
          </div>

          <nav className="top-nav hidden xl:flex" aria-label="Primary">
            <Tooltip content="Jump to the search section">
              <button className="top-nav__item" type="button" onClick={() => scrollToId('search-section')}>search</button>
            </Tooltip>
            <Tooltip content="Jump to the search results area">
              <button className="top-nav__item" type="button" onClick={() => scrollToId('results-section')}>results</button>
            </Tooltip>
            <Tooltip content="Jump to indexing and live-capture tools">
              <button className="top-nav__item" type="button" onClick={() => scrollToId('operations-section')}>operations</button>
            </Tooltip>
          </nav>

          <div className="flex items-center gap-3">
            <Tooltip content={dbConnected ? 'Actian VectorAI DB is connected and ready' : 'Backend is warming up or database is unavailable'}>
              <div className="status-pill">
                <span className={`status-pill__dot ${dbConnected ? 'status-pill__dot--live' : 'status-pill__dot--down'}`} />
                <span>{dbConnected ? 'Actian VectorAI DB online' : 'backend warming'}</span>
              </div>
            </Tooltip>
            <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <button
                className="icon-shell"
                type="button"
                aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
                onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="workspace-shell workspace-shell--clean">
        <section className="hero-console" id="search-section">
          <div className="hero-console__eyebrow">
            <span className="hero-console__pulse" />
            local investigation workflow
          </div>
          <h1 className="hero-console__title">Search CCTV footage in plain language.</h1>
          <p className="hero-console__copy">
            Find store entry moments, shelf activity, or visually similar frames from indexed clips without sending footage to the cloud.
          </p>

          <div className="hero-workflow" aria-label="How the project works">
            {workflowSteps.map((step) => (
              <Tooltip key={step.title} content={step.copy}>
                <div className="hero-workflow__step">
                  <div className="hero-workflow__title">{step.title}</div>
                  <div className="hero-workflow__copy">{step.copy}</div>
                </div>
              </Tooltip>
            ))}
          </div>

          <div className="hero-console__search">
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              onVoiceResult={handleVoiceResult}
              suggestedQueries={suggestedQueries}
              suggestionLabel={suggestionLabel}
            />
          </div>

          <div className="hero-console__stats">
            <div className="hero-stat hero-stat--primary">
              <div className="hero-stat__value">{indexedFrames > 0 ? indexedFrames.toLocaleString() : '--'}</div>
              <div className="hero-stat__label">indexed frames</div>
            </div>
            <div className="hero-stat hero-stat--neutral">
              <div className="hero-stat__value">{indexedCameras.length || '--'}</div>
              <div className="hero-stat__label">indexed cameras</div>
            </div>
            <div className="hero-stat hero-stat--signal">
              <div className="hero-stat__value">{dbConnected ? 'ready' : 'warming'}</div>
              <div className="hero-stat__label">backend status</div>
            </div>
          </div>
        </section>

        <section className="dashboard-grid dashboard-grid--clean">
          <div className="dashboard-column dashboard-column--filters" id="filters-section">
            <SectionTag label="filters" />
            <div className="console-panel">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__title">Refine the search</div>
                  <div className="console-panel__copy">Narrow by camera, date, hour, or motion threshold before running a query.</div>
                </div>
                <Filter size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>
          </div>

          <div className="dashboard-column dashboard-column--results" id="results-section">
            <SectionTag label="results" />

            <div className="results-head">
              <div>
                <div className="console-panel__title">
                  {hasSearched ? 'Search results' : 'Run a query to view matching events and frames'}
                </div>
                <div className="console-panel__copy">{resultsSummary}</div>
              </div>
              <div className="results-head__mode" aria-label="Results display mode">
                <Tooltip content="Group matching moments into time windows">
                  <button
                    type="button"
                    className={`mode-chip ${viewMode === 'events' ? 'mode-chip--active' : ''}`}
                    onClick={() => setViewMode('events')}
                  >
                    <List size={13} /> event groups
                  </button>
                </Tooltip>
                <Tooltip content="Review matching frames one by one">
                  <button
                    type="button"
                    className={`mode-chip ${viewMode === 'frames' ? 'mode-chip--active' : ''}`}
                    onClick={() => setViewMode('frames')}
                  >
                    <LayoutGrid size={13} /> individual frames
                  </button>
                </Tooltip>
              </div>
            </div>

            {error && (
              <div
                className="animate-fade-up mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#EF4444', flexShrink: 0 }} />
                <p style={{ color: '#FCA5A5', fontSize: '13px' }}>{error}</p>
              </div>
            )}

            {retrievalSanity?.ok === false && (
              <div
                className="animate-fade-up mb-4 flex items-start justify-between gap-4 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}
              >
                <div>
                  <p style={{ color: '#FBBF24', fontSize: '13px', fontWeight: 700 }}>Retrieval check failed</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                    Frames are indexed, but similarity retrieval is unhealthy. Use <strong>Rebuild index</strong> in the operations panel to recover the collection.
                  </p>
                </div>
                <button type="button" className="btn-ghost" onClick={() => scrollToId('operations-section')}>
                  Open operations
                </button>
              </div>
            )}

            {!loading && hasSearched && (
              <div className="mb-4">
                <Timeline cameraId={filters.cameraId} date={filters.date} onBucketClick={handleTimelineBucketClick} />
              </div>
            )}

            <div className="results-stage">
              {loading
                ? <Skeleton />
                : hasSearched
                  ? <ResultsGrid results={results} viewMode={viewMode} onFrameSelect={setSelectedFrame} onSimilaritySearch={handleSimilaritySearch} />
                  : indexedFrames > 0 ? (
                    <div className="results-empty">
                      <div className="results-empty__icon">
                        <Search size={24} />
                      </div>
                      <h3>Start with a real store-footage query</h3>
                      <p>Use the search box above and the footage-specific prompt suggestions to run the first query.</p>
                    </div>
                  ) : (
                    <div className="results-empty">
                      <div className="results-empty__icon">
                        <Database size={24} />
                      </div>
                      <h3>No indexed footage yet</h3>
                      <p>Use the operations panel to add a video, scan the shared footage folder, then come back here to search what happened.</p>
                      <div className="hero-workflow mt-6">
                        {workflowSteps.map((step) => (
                          <div key={step.title} className="hero-workflow__step">
                            <div className="hero-workflow__title">{step.title}</div>
                            <div className="hero-workflow__copy">{step.copy}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
            </div>
          </div>

          <div className="dashboard-column dashboard-column--side" id="operations-section">
            <SectionTag label="operations" />

            <div className="console-panel">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__title">Ingest and capture</div>
                  <div className="console-panel__copy">
                    Add recorded footage from the shared folder or start a live source for motion-gated indexing.
                  </div>
                </div>
                {activePanel === 'live'
                  ? <Radio size={14} style={{ color: 'var(--accent)' }} />
                  : <Database size={14} style={{ color: 'var(--accent)' }} />
                }
              </div>
              <div className="results-head__mode" style={{ marginBottom: '16px' }}>
                <Tooltip content="Open the recorded-footage indexing tools">
                  <button
                    type="button"
                    className={`mode-chip ${activePanel === 'index' ? 'mode-chip--active' : ''}`}
                    onClick={() => setActivePanel('index')}
                  >
                    <Database size={13} /> index footage
                  </button>
                </Tooltip>
                <Tooltip content="Open the optional live capture tools">
                  <button
                    type="button"
                    className={`mode-chip ${activePanel === 'live' ? 'mode-chip--active' : ''}`}
                    onClick={() => setActivePanel('live')}
                  >
                    <Radio size={13} /> live capture
                  </button>
                </Tooltip>
              </div>
              {activePanel === 'live' ? <LiveFeedPanel /> : <IndexPanel onIndexedCamera={handleIndexedCamera} />}
            </div>

            <div className="console-panel" id="status-section">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__title">System status</div>
                  <div className="console-panel__copy">Current database connection and indexed footage summary.</div>
                </div>
                <Shield size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <StatusBar />
            </div>
          </div>
        </section>
      </div>

      {selectedFrame && <FrameModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />}
    </main>
  )
}
