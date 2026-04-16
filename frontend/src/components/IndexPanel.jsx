import { useState, useRef, useEffect } from 'react'
import { Upload, FolderOpen, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadAndIndex, scanAndIndex, getIndexingJobs } from '../api'

function JobStatus({ job }) {
  const icon = job.status === 'done'
    ? <CheckCircle size={14} className="text-emerald-400" />
    : job.status === 'error'
    ? <AlertCircle size={14} className="text-red-400" />
    : <Loader2 size={14} className="animate-spin text-brand-500" />

  return (
    <div className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
      {icon}
      <span className="text-gray-300 flex-1 truncate">{job.video}</span>
      <span className={`font-medium ${
        job.status === 'done' ? 'text-emerald-400' :
        job.status === 'error' ? 'text-red-400' : 'text-brand-500'
      }`}>
        {job.status === 'done'
          ? `${job.frames_indexed} frames`
          : job.status === 'error'
          ? 'failed'
          : 'indexing...'}
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
      <h3 className="text-sm font-semibold text-gray-300">Index Footage</h3>

      {/* Camera ID */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Camera ID (optional)</label>
        <input
          type="text"
          placeholder="e.g. cam1, entrance, lobby"
          value={cameraId}
          onChange={(e) => setCameraId(e.target.value)}
          className="input-field text-sm py-2"
        />
      </div>

      {/* Upload */}
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileRef}
          onChange={handleUpload}
          accept=".mp4,.avi,.mkv,.mov,.m4v,.ts"
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-secondary flex items-center gap-2 text-sm flex-1"
        >
          {uploading
            ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
            : <><Upload size={14} /> Upload video</>
          }
        </button>

        <button
          onClick={handleScan}
          disabled={scanning}
          title="Scan footage/ directory"
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          {scanning
            ? <Loader2 size={14} className="animate-spin" />
            : <FolderOpen size={14} />
          }
          Scan folder
        </button>
      </div>

      <p className="text-xs text-gray-600">
        Supports: MP4, AVI, MKV, MOV, TS. Indexes 1 frame/sec, motion-gated.
      </p>

      {/* Jobs */}
      {jobList.length > 0 && (
        <div className="glass rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2 font-medium">Indexing jobs</div>
          {jobList.slice(-8).map(([id, job]) => (
            <JobStatus key={id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
