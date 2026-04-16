import { useState, useRef } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import VoiceButton from './VoiceButton'

const EXAMPLE_QUERIES = [
  'person leaving a bag near the counter',
  'someone entering through the back door',
  'two people having an argument',
  'car parking in restricted area',
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

  const clear = () => {
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you're looking for... e.g. 'person leaving a bag near the counter'"
              className="input-field pl-11 pr-28 py-4 text-base rounded-xl border-white/10
                         focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 w-full"
              disabled={loading}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <button type="button" onClick={clear} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                  <X size={16} />
                </button>
              )}
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="btn-primary flex items-center gap-2 py-2 px-4 text-sm"
              >
                {loading ? (
                  <><Loader2 size={15} className="animate-spin" /> Searching</>
                ) : (
                  <><Search size={15} /> Search</>
                )}
              </button>
            </div>
          </div>

          {/* Voice button — sits outside the text input */}
          <VoiceButton
            onResult={onVoiceResult}
            onTranscript={(text) => setQuery(text)}
            disabled={loading}
          />
        </div>
      </form>

      {/* Example queries */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 self-center">Try:</span>
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => handleExample(q)}
            className="text-xs px-3 py-1.5 rounded-full bg-surface-700 hover:bg-surface-600
                       text-gray-400 hover:text-gray-200 border border-white/5 hover:border-white/10
                       transition-all duration-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
