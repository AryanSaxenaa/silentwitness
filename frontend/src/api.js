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

export function thumbnailUrl(thumbnailPath) {
  if (!thumbnailPath) return null
  const filename = thumbnailPath.split('/').pop()
  return `${API_BASE}/thumbnails/${filename}`
}
