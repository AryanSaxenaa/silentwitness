import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react'
import { voiceQuery } from '../api'

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
    try {
      const data = await voiceQuery(blob, mimeType)
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

  // Derive button styles from design tokens
  const btnStyle = (() => {
    if (state === 'recording') return {
      background: '#EF4444',
      border: '1px solid #EF4444',
      boxShadow: '0 0 16px rgba(239,68,68,0.35)',
    }
    if (state === 'processing') return {
      background: 'rgba(245,158,11,0.15)',
      border: '1px solid rgba(245,158,11,0.3)',
    }
    if (state === 'error') return {
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.3)',
    }
    return {
      background: 'rgba(255,255,255,0.08)',
      border: '2px solid var(--accent)',
      boxShadow: '0 0 18px rgba(3,196,255,0.12)',
    }
  })()

  const labelColor = state === 'recording' ? '#FCA5A5'
    : state === 'processing' ? '#FCD34D'
    : state === 'error' ? '#FCA5A5'
    : 'var(--text-muted)'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={disabled || state === 'processing'}
        title={state === 'recording' ? 'Click to stop recording' : 'Click to speak your query'}
        className="relative flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-50"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '16px',
          cursor: state === 'processing' ? 'wait' : 'pointer',
          ...btnStyle,
        }}
      >
        {state === 'processing' ? (
          <Loader2 size={18} style={{ color: '#FCD34D' }} className="animate-spin" />
        ) : state === 'recording' ? (
          <MicOff size={18} style={{ color: 'white' }} />
        ) : state === 'error' ? (
          <Mic size={18} style={{ color: '#FCA5A5' }} />
        ) : (
          <Mic size={18} style={{ color: 'var(--text-secondary)' }} />
        )}

        {/* Pulse ring when recording */}
        {state === 'recording' && (
          <span
            className="absolute inset-0 animate-ping"
            style={{ borderRadius: '12px', background: 'rgba(239,68,68,0.35)' }}
          />
        )}
      </button>

      {/* State label */}
      <span style={{ fontSize: '10px', lineHeight: 1, color: labelColor }}>
        {state === 'recording' ? 'Recording...' :
         state === 'processing' ? 'Transcribing...' :
         state === 'error' ? (errorMsg || 'Error') :
         'Voice'}
      </span>

      {/* Transcript preview */}
      {transcript && state === 'idle' && (
        <div
          className="flex items-center gap-1 truncate"
          style={{ fontSize: '10px', color: 'var(--accent)', maxWidth: '120px' }}
        >
          <Volume2 size={9} />
          <span className="truncate">"{transcript}"</span>
        </div>
      )}
    </div>
  )
}
