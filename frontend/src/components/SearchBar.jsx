import { useState, useRef } from 'react'
import { Search, Loader2, X, ArrowRight } from 'lucide-react'
import VoiceButton from './VoiceButton'
import Tooltip from './Tooltip'

const EXAMPLE_QUERIES = [
  'person entering store',
  'person near shelves',
  'person walking in the store',
  'two people in frame',
  'person at entrance',
  'customer moving through aisle',
]

export default function SearchBar({ onSearch, loading, onVoiceResult }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  const handleExample = (q) => {
    setQuery(q)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className="relative"
          style={{
            padding: '10px',
            borderRadius: '18px',
            border: '1px solid rgba(137, 206, 255, 0.16)',
            background: 'var(--panel-strong)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 20px rgba(0, 180, 255, 0.08)',
          }}
        >
          <div className="search-shell">
            <div className="search-input-shell">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--accent)' }}
                />
                <Tooltip
                  content="Enter a natural-language query such as person entering store or person near shelves"
                  className="tooltip--block"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe what you're looking for in plain English..."
                    className="input-field"
                    style={{
                      width: '100%',
                      paddingLeft: '46px',
                      paddingRight: query ? '46px' : '18px',
                      paddingTop: '20px',
                      paddingBottom: '20px',
                      fontSize: '17px',
                      borderRadius: '12px',
                      fontFamily: 'var(--mono)',
                      letterSpacing: '0.02em',
                    }}
                    disabled={loading}
                  />
                </Tooltip>
                {query && (
                  <Tooltip content="Clear the current query">
                    <button
                      type="button"
                      onClick={() => { setQuery(''); inputRef.current?.focus() }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X size={15} />
                    </button>
                  </Tooltip>
                )}
              </div>

              <Tooltip content="Run the current search query">
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="search-submit search-submit--inline"
                >
                  {loading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <>Search</>
                  }
                </button>
              </Tooltip>
            </div>

            <VoiceButton
              onResult={onVoiceResult}
              onTranscript={(text) => setQuery(text)}
              disabled={loading}
            />
          </div>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <span className="section-label mr-1">Suggested prompts for current demo footage</span>
        {EXAMPLE_QUERIES.map((q) => (
          <Tooltip key={q} content={`Fill the search box with: ${q}`}>
            <button
              onClick={() => handleExample(q)}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '8px 12px',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(137, 206, 255, 0.24)'
                e.currentTarget.style.color = 'var(--accent)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {q} <ArrowRight size={10} />
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
