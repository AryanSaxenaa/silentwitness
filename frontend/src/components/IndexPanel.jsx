import { useState, useRef, useEffect } from 'react'
import { Upload, FolderOpen, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadAndIndex, scanAndIndex, getIndexingJobs } from '../api'

function JobStatus({ job }) {
  const dotColor = job.status === 'done' ? '#6EE7B7' : job.status === 'error' ? '#FCA5A5' : 'var(--accent)'
  return (
    <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
      {job.status === 'running'
        ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        : <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: dotColor, flexShrink: 0 }} />}
      <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{job.video}</span>
      <span className="font-mono" style={{ color: dotColor, fontSize: '11px' }}>
        {job.status === 'done' ? `${job.frames_indexed}f` : job.status === 'error' ? 'error' : '...'}
      </span>
    </div>
  )
}

export default function IndexPanel() {
  const [jobs, setJobs] = useState({})
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cameraId, setCameraId] = useState('')
  const fileRef = useRef()

  // Poll job statuses
  useEffect(() => {
    const poll = () => getIndexingJobs().then(setJobs).catch(() => {})
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadAndIndex(file, cameraId || null)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleScan = async () => {
    setScanning(true)
    try {
      await scanAndIndex()
    } catch (err) {
      console.error(err)
    } finally {
      setScanning(false)
    }
  }

  const jobList = Object.entries(jobs)

  return (
    <div className="space-y-4">
      {/* Camera ID */}
      <div>
        <label className="section-label block mb-2">Camera ID</label>
        <input
          type="text"
          placeholder="cam1, entrance, lobby..."
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
          className="input-field"
          style={{ fontSize: '13px' }}
        />
      </div>

      {/* Buttons */}
      <input type="file" ref={fileRef} onChange={handleUpload} accept=".mp4,.avi,.mkv,.mov,.m4v,.ts" className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="btn-ghost w-full justify-center"
        style={{ fontSize: '13px' }}
      >
        {uploading ? <><Loader2 size={13} className="animate-spin" /> Uploading...</> : <><Upload size={13} /> Upload video</>}
      </button>

      <button
        onClick={handleScan}
        disabled={scanning}
        className="btn-primary w-full justify-center"
        style={{ fontSize: '13px' }}
      >
        {scanning ? <><Loader2 size={13} className="animate-spin" /> Scanning...</> : <><FolderOpen size={13} /> Scan footage folder</>}
      </button>

      <p className="section-label" style={{ color: 'var(--text-muted)' }}>MP4, AVI, MKV, MOV · 1 fps · motion-gated</p>

      {jobList.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <p className="section-label mb-2">Indexing jobs</p>
          {jobList.slice(-8).map(([id, job]) => <JobStatus key={id} job={job} />)}
        </div>
      )}
    </div>
  )
}
