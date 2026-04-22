import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
})

export async function getStatus() {
  const { data } = await api.get('/api/status')
  return data
}

export async function searchFootage({
  query,
  cameraId,
  date,
  hourStart,
  hourEnd,
  minMotionScore,
  limit = 20,
  groupIntoEvents = true,
}) {
  const { data } = await api.post('/api/search', {
    query,
    camera_id: cameraId || null,
    date: date || null,
    hour_start: hourStart ?? null,
    hour_end: hourEnd ?? null,
    min_motion_score: minMotionScore ?? null,
    limit,
    group_into_events: groupIntoEvents,
  })
  return data
}

export async function uploadAndIndex(file, cameraId, fpsSample = 1.0) {
  const formData = new FormData()
  formData.append('file', file)
  if (cameraId) formData.append('camera_id', cameraId)
  formData.append('fps_sample', fpsSample)

  const { data } = await api.post('/api/index/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function scanAndIndex(fpsSample = 1.0) {
  const { data } = await api.post(`/api/index/scan?fps_sample=${fpsSample}`)
  return data
}

export async function rebuildIndex(fpsSample = 1.0) {
  const { data } = await api.post(`/api/index/rebuild?fps_sample=${fpsSample}`)
  return data
}

export async function getIndexingJobs() {
  const { data } = await api.get('/api/index/jobs')
  return data
}

export async function getCameras() {
  const { data } = await api.get('/api/cameras')
  return data
}

export async function listFootage() {
  const { data } = await api.get('/api/footage')
  return data
}

export async function searchSimilar({ frameId, cameraId, date, hourStart, hourEnd, minMotionScore, excludeSameVideo = false, limit = 20 }) {
  const { data } = await api.post('/api/search/similar', {
    frame_id: frameId,
    camera_id: cameraId || null,
    date: date || null,
    hour_start: hourStart ?? null,
    hour_end: hourEnd ?? null,
    min_motion_score: minMotionScore ?? null,
    exclude_same_video: excludeSameVideo,
    limit,
  })
  return data
}

export async function voiceQuery(audioBlob, mimeType = 'audio/webm') {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'query.webm')
  const { data } = await api.post('/api/voice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return data
}

export async function getTimeline({ cameraId, date, bucketMinutes = 5 } = {}) {
  const params = new URLSearchParams({ bucket_minutes: bucketMinutes })
  if (cameraId) params.append('camera_id', cameraId)
  if (date) params.append('date', date)
  const { data } = await api.get(`/api/timeline?${params}`)
  return data
}

export async function startLiveFeed({ source = '0', cameraId = 'live', fpsSample = 1.0, minMotionScore = 0.01 }) {
  const { data } = await api.post('/api/live/start', {
    source: String(source),
    camera_id: cameraId,
    fps_sample: fpsSample,
    min_motion_score: minMotionScore,
  })
  return data
}

export async function stopLiveFeed(cameraId = 'live') {
  const { data } = await api.post(`/api/live/stop?camera_id=${encodeURIComponent(cameraId)}`)
  return data
}

export async function getLiveStatus() {
  const { data } = await api.get('/api/live/status')
  return data
}

export function thumbnailUrl(thumbnailPath) {
  if (!thumbnailPath) return null
  // Normalize both forward and backslashes (Windows paths) before extracting filename
  const filename = thumbnailPath.replace(/\\/g, '/').split('/').pop()
  return `${API_BASE}/thumbnails/${filename}`
}
