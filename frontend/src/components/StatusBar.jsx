export default function StatusBar({ status }) {
  const frames = status?.stats?.total_frames ?? 0
  const cameras = status?.cameras ?? []
  const connected = status?.db_connected ?? false
  const retrievalSanity = status?.runtime_health?.retrieval_sanity
  const lastJob = status?.runtime_health?.last_index_job
  const sanityOk = retrievalSanity?.ok
  const ocrFrames = lastJob?.ocr_frames_detected ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div className="section-label">Database</div>
          <div className="mt-2 text-[13px]" style={{ color: connected ? '#34D399' : '#F87171', fontWeight: 700 }}>
            {connected ? 'Actian VectorAI DB connected' : 'Database offline'}
          </div>
        </div>

        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div className="section-label">Retrieval</div>
          <div className="mt-2 text-[13px]" style={{ color: sanityOk === false ? '#F59E0B' : sanityOk ? '#34D399' : 'var(--text-secondary)', fontWeight: 700 }}>
            {sanityOk === false ? 'Needs rebuild' : sanityOk ? 'Healthy' : 'Pending'}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-start justify-between gap-3">
          <span className="section-label" style={{ whiteSpace: 'normal' }}>Indexed frames</span>
          <span>{frames.toLocaleString()}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="section-label" style={{ whiteSpace: 'normal' }}>Indexed cameras</span>
          <span>{cameras.length ? cameras.join(' · ') : '--'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="section-label" style={{ whiteSpace: 'normal' }}>Last index job</span>
          <span>{lastJob?.video || 'No completed jobs yet'}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="section-label" style={{ whiteSpace: 'normal' }}>OCR hits in last job</span>
          <span>{ocrFrames}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="section-label" style={{ whiteSpace: 'normal' }}>Similarity check</span>
          <span>{retrievalSanity?.similar_results ?? 0} matches</span>
        </div>
      </div>

      <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        <div className="section-label">Offline mode</div>
        <div className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Footage stays on this machine. Search currently supports semantic retrieval, metadata filters, OCR text filtering, and frame-to-frame similarity on the same local index.
        </div>
      </div>
    </div>
  )
}
