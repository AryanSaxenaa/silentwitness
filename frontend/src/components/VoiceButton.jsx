import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function VoiceButton({ onResult, onTranscript, disabled }) {
  const [state, setState] = useState('idle') // idle | recording | processing | error
  const [transcript, setTranscript] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  const startRecording = async () => {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        await sendAudio(blob, mimeType)
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start()
      setState('recording')
    } catch (err) {
      setErrorMsg('Microphone access denied')
      setState('error')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState('processing')
    }
  }

  const sendAudio = async (blob, mimeType) => {
    const formData = new FormData()
    formData.append('audio', blob, 'query.webm')

    try {
      const { data } = await axios.post(`${API_BASE}/api/voice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      setTranscript(data.transcribed_query || '')
      if (onTranscript) onTranscript(data.transcribed_query)
      if (onResult) onResult(data)
      setState('idle')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Transcription failed'
      setErrorMsg(msg)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const handleClick = () => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle' || state === 'error') {
      startRecording()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={disabled || state === 'processing'}
        title={state === 'recording' ? 'Click to stop recording' : 'Click to speak your query'}
        className={`
          relative w-11 h-11 rounded-xl flex items-center justify-center
          transition-all duration-200 active:scale-95 disabled:opacity-50
          ${state === 'recording'
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 animate-pulse'
            : state === 'processing'
            ? 'bg-amber-500/20 border border-amber-500/30 cursor-wait'
            : state === 'error'
            ? 'bg-red-500/20 border border-red-500/30'
            : 'bg-surface-600 hover:bg-surface-500 border border-white/10'
          }
        `}
      >
        {state === 'processing' ? (
          <Loader2 size={18} className="animate-spin text-amber-400" />
        ) : state === 'recording' ? (
          <MicOff size={18} className="text-white" />
        ) : state === 'error' ? (
          <Mic size={18} className="text-red-400" />
        ) : (
          <Mic size={18} className="text-gray-300" />
        )}

        {/* Pulse ring when recording */}
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-xl bg-red-500/40 animate-ping" />
        )}
      </button>

      {/* State label */}
      <span className={`text-[10px] leading-none ${
        state === 'recording' ? 'text-red-400' :
        state === 'processing' ? 'text-amber-400' :
        state === 'error' ? 'text-red-400' :
        'text-gray-600'
      }`}>
        {state === 'recording' ? 'Recording...' :
         state === 'processing' ? 'Transcribing...' :
         state === 'error' ? (errorMsg || 'Error') :
         'Voice'}
      </span>

      {/* Transcript preview */}
      {transcript && state === 'idle' && (
        <div className="flex items-center gap-1 text-[10px] text-brand-400 max-w-[120px] truncate">
          <Volume2 size={9} />
          <span className="truncate">"{transcript}"</span>
        </div>
      )}
    </div>
  )
}
