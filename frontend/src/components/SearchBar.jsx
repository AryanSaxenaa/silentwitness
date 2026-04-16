import { useState, useRef } from 'react'
import { Search, Loader2, X, ArrowRight } from 'lucide-react'
import VoiceButton from './VoiceButton'

const EXAMPLE_QUERIES = [
  'person leaving a bag near the counter',
  'someone entering through the back door',
  'two people having an argument',
  'car in restricted area',
  'person running',
  'package left unattended',
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
    onSearch(q)
  }

  return (
    <div className="w-full">
      {/* Main input row */}
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          {/* Input wrapper */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for in plain English..."
              className="input-field"
              style={{ paddingLeft: '42px', paddingRight: query ? '100px' : '16px', paddingTop: '14px', paddingBottom: '14px', fontSize: '15px', borderRadius: '10px' }}
              disabled={loading}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                className="absolute right-[70px] top-1/2 -translate-y-1/2 p-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={15} />
              </button>
            )}
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="btn-primary absolute right-2 top-1/2 -translate-y-1/2"
              style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '7px' }}
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <><Search size={13} /> Search</>
              }
            </button>
          </div>

          {/* Voice button */}
          <VoiceButton
            onResult={onVoiceResult}
            onTranscript={(text) => setQuery(text)}
            disabled={loading}
          />
        </div>
      </form>

      {/* Example queries — supermemory pill style */}
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="section-label mr-1">Try:</span>
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleExample(q)}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-all"
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--border-hover)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            {q} <ArrowRight size={10} />
          </button>
        ))}
      </div>
    </div>
  )
}
