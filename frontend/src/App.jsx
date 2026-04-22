import { useEffect, useState } from 'react'
import {
  Eye,
  LayoutGrid,
  List,
  X,
  Radio,
  Search,
  Filter,
  Shield,
  Database,
  TerminalSquare,
  Bell,
  ChevronRight,
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
import { getStatus, searchFootage, searchSimilar } from './api'

function SectionTag({ index, total, label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="section-label">[ {index} / {total} ]</span>
      {label && <span className="section-label">{label}</span>}
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
  const [showIndexPanel, setShowIndexPanel] = useState(false)
  const [showLivePanel, setShowLivePanel] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.localStorage.getItem('silentwitness-theme') || 'dark'
  })
  const [filters, setFilters] = useState({
    cameraId: null, date: null, hourStart: null, hourEnd: null, minMotionScore: null,
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
      const data = await searchSimilar({ frameId, limit: 20 })
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

  const TOTAL_SECTIONS = 3
  const indexedFrames = status?.stats?.total_frames ?? 0
  const indexedCameras = status?.cameras ?? []
  const dbConnected = status?.db_connected ?? false
  const statTiles = [
    { label: 'indexed frames', value: indexedFrames > 0 ? indexedFrames.toLocaleString() : '--', tone: 'primary' },
    { label: 'active cameras', value: indexedCameras.length ? indexedCameras.length.toString() : '--', tone: 'neutral' },
    { label: 'retrieval mode', value: viewMode === 'events' ? 'clustered' : 'frame', tone: 'signal' },
  ]
  const sideActions = [
    {
      id: 'events',
      label: 'Events',
      icon: <List size={15} />,
      active: viewMode === 'events',
      onClick: () => setViewMode('events'),
    },
    {
      id: 'frames',
      label: 'Frames',
      icon: <LayoutGrid size={15} />,
      active: viewMode === 'frames',
      onClick: () => setViewMode('frames'),
    },
    {
      id: 'index',
      label: 'Index',
      icon: <Database size={15} />,
      active: showIndexPanel,
      onClick: () => { setShowIndexPanel(!showIndexPanel); setShowLivePanel(false) },
    },
    {
      id: 'live',
      label: 'Live',
      icon: <Radio size={15} />,
      active: showLivePanel,
      onClick: () => { setShowLivePanel(!showLivePanel); setShowIndexPanel(false) },
    },
  ]

  return (
    <main className="app-shell">
      <header className="top-shell">
        <div className="top-shell__inner">
          <div className="flex items-center gap-8">
            <div className="brand-lockup">
              <div className="brand-mark">
                <Eye size={16} />
              </div>
              <div>
                <div className="brand-title">SILENTWITNESS // CORE</div>
                <div className="brand-subtitle">offline semantic search for surveillance footage</div>
              </div>
            </div>

            <nav className="top-nav hidden xl:flex">
              <button className="top-nav__item top-nav__item--active" onClick={() => scrollToId('search-section')}>search</button>
              <button className="top-nav__item" onClick={() => scrollToId('results-section')}>results</button>
              <button className="top-nav__item" onClick={() => scrollToId('index-section')}>index</button>
              <button className="top-nav__item" onClick={() => scrollToId('status-section')}>status</button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="status-pill">
              <span className={`status-pill__dot ${dbConnected ? 'status-pill__dot--live' : 'status-pill__dot--down'}`} />
              <span>{dbConnected ? 'vector db online' : 'backend warming'}</span>
            </div>
            <button className="icon-shell" type="button" aria-label="jump to results" title="Jump to results" onClick={() => scrollToId('results-section')}>
              <Bell size={15} />
            </button>
            <button
              className="icon-shell"
              type="button"
              aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <aside className="side-rail hidden lg:flex">
        <div className="side-rail__head">
          <div className="side-rail__badge">
            <Shield size={15} />
          </div>
          <span>OPS-04</span>
        </div>

        <div className="side-rail__stack">
          {sideActions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`side-rail__item ${item.active ? 'side-rail__item--active' : ''}`}
              aria-label={item.label}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="side-rail__foot">
          <button type="button" className="side-rail__mini" title="Jump to search" onClick={() => scrollToId('search-section')}>
            <TerminalSquare size={15} />
          </button>
        </div>
      </aside>

      <div className="workspace-shell">
        <section className="hero-console" id="search-section">
          <div className="hero-console__eyebrow">
            <span className="hero-console__pulse" />
            local retrieval surface // Actian VectorAI DB
          </div>
          <h1 className="hero-console__title">Search Security Footage Faster</h1>
          <p className="hero-console__copy">
            Find the right moment in your indexed store footage using natural language, visual similarity, and timeline-based review without leaving the machine.
          </p>
          <div className="hero-console__search">
            <SearchBar onSearch={handleSearch} loading={loading} onVoiceResult={handleVoiceResult} />
          </div>
          <div className="hero-console__stats">
            {statTiles.map((stat) => (
              <div key={stat.label} className={`hero-stat hero-stat--${stat.tone}`}>
                <div className="hero-stat__value">{stat.value}</div>
                <div className="hero-stat__label">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mobile-actions lg:hidden">
          {sideActions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`mobile-actions__item ${item.active ? 'mobile-actions__item--active' : ''}`}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <section className="dashboard-grid">
          <div className="dashboard-column dashboard-column--filters">
            <SectionTag index={1} total={TOTAL_SECTIONS} label="filters" />
            <div className="console-panel">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__kicker">[ FILTERS ]</div>
                  <div className="console-panel__title">Query constraints</div>
                </div>
                <Filter size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>

            {!hasSearched && (
              <div className="console-panel">
                <div className="console-panel__header">
                  <div>
                    <div className="console-panel__kicker">[ STACK ]</div>
                    <div className="console-panel__title">Core components</div>
                  </div>
                  <Database size={14} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="token-cloud">
                  {['Actian VectorAI DB', 'CLIP ViT-B/32', 'OpenCV', 'Whisper', 'FastAPI', 'React'].map((t) => (
                    <span key={t} className="badge badge-gray font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-column dashboard-column--results" id="results-section">
            <SectionTag index={2} total={TOTAL_SECTIONS} label="results" />

            <div className="results-head">
              <div>
                <div className="console-panel__kicker">[ SEARCH RESULTS ]</div>
                <div className="console-panel__title">
                  {hasSearched ? 'Matched events and searchable frame hits' : 'Run a query to surface events and frame matches'}
                </div>
              </div>
              <div className="results-head__mode">
                <button type="button" className={`mode-chip ${viewMode === 'events' ? 'mode-chip--active' : ''}`} onClick={() => setViewMode('events')} title="Show grouped events">
                  <List size={13} /> events
                </button>
                <button type="button" className={`mode-chip ${viewMode === 'frames' ? 'mode-chip--active' : ''}`} onClick={() => setViewMode('frames')} title="Show individual frames">
                  <LayoutGrid size={13} /> frames
                </button>
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
                  : (
                    <div className="results-empty">
                      <div className="results-empty__icon">
                        <Search size={24} />
                      </div>
                      <h3>Start with a real store-footage query</h3>
                      <p>Use the prompt suggestions below the search bar, or start with “person entering store” to match the shipped demo footage.</p>
                    </div>
                  )}
            </div>
          </div>

          <div className="dashboard-column dashboard-column--side" id="index-section">
            <SectionTag index={3} total={TOTAL_SECTIONS} label={showLivePanel ? 'live' : 'index'} />
            <div className="console-panel">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__kicker">{showLivePanel ? '[ LIVE CAPTURE ]' : '[ INDEXING ]'}</div>
                  <div className="console-panel__title">{showLivePanel ? 'Live feed control' : 'Index footage and review jobs'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`icon-shell ${!showLivePanel ? 'icon-shell--active' : ''}`}
                    type="button"
                    onClick={() => { setShowIndexPanel(true); setShowLivePanel(false) }}
                    aria-label="show indexing"
                    title="Show indexing"
                  >
                    <Database size={14} />
                  </button>
                  <button
                    className={`icon-shell ${showLivePanel ? 'icon-shell--active icon-shell--danger' : ''}`}
                    type="button"
                    onClick={() => { setShowLivePanel(true); setShowIndexPanel(false) }}
                    aria-label="show live feed"
                    title="Show live feed"
                  >
                    <Radio size={14} />
                  </button>
                  {(showIndexPanel || showLivePanel) && (
                    <button
                      className="icon-shell"
                      type="button"
                      onClick={() => { setShowIndexPanel(false); setShowLivePanel(false) }}
                      aria-label="close panel"
                      title="Close side panel"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {showLivePanel ? <LiveFeedPanel /> : <IndexPanel />}
            </div>

            <div className="console-panel" id="status-section">
              <div className="console-panel__header">
                <div>
                  <div className="console-panel__kicker">[ SYSTEM STATUS ]</div>
                  <div className="console-panel__title">Operational summary</div>
                </div>
                <Shield size={14} style={{ color: 'var(--accent)' }} />
              </div>
              <StatusBar />
            </div>
          </div>
        </section>

        <footer className="bottom-bar">
          <div className="bottom-bar__left">
            <span>[ SYSTEM_HEALTH: {dbConnected ? 'ONLINE' : 'WARMING'} ]</span>
            <span>SCANS: {indexedFrames > 0 ? indexedFrames.toLocaleString() : '--'}</span>
            <span>STORAGE: ACTIAN VECTORAI DB</span>
          </div>
          <div className="bottom-bar__right">
            <span className="bottom-bar__signal" />
            <span>FULLY LOCAL INVESTIGATION LOOP</span>
            <button type="button" className="bottom-bar__jump" onClick={() => scrollToId('search-section')} title="Back to top">
              <ChevronRight size={13} />
            </button>
          </div>
        </footer>
      </div>

      {selectedFrame && <FrameModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />}
    </main>
  )
}
