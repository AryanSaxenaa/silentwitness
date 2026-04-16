"""
Voice query transcription using OpenAI Whisper (runs 100% locally).
Model: whisper-tiny — ~150MB, fast enough for real-time demo use.
On 8GB RAM: coexists with CLIP and VectorAI DB comfortably.
"""
import io
import logging
import tempfile
import os
import threading

import numpy as np

logger = logging.getLogger(__name__)

_whisper_model = None
_whisper_lock = threading.Lock()


def get_whisper_model():
    """Load Whisper tiny model once, thread-safe."""
    global _whisper_model
    if _whisper_model is None:
        with _whisper_lock:
            if _whisper_model is None:
                logger.info("Loading Whisper tiny model (~150MB)...")
                import whisper
                _whisper_model = whisper.load_model("tiny")
                logger.info("Whisper model loaded.")
    return _whisper_model


def transcribe_audio_bytes(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """
    Transcribe raw audio bytes to text using local Whisper.

    Args:
        audio_bytes: raw audio data (webm, wav, mp3, etc.)
        mime_type: hint for format detection

    Returns:
        Transcribed text string
    """
    model = get_whisper_model()

    # Map MIME type to a file extension Whisper/ffmpeg can handle
    _MIME_TO_EXT = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/opus": ".ogg",
        "audio/mp4": ".m4a",
        "audio/m4a": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/flac": ".flac",
    }
    # Normalize: "audio/webm;codecs=opus" → "audio/webm"
    mime_base = mime_type.split(";")[0].strip().lower()
    suffix = _MIME_TO_EXT.get(mime_base, ".webm")  # default to webm if unknown
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = model.transcribe(tmp_path, language="en", fp16=False)
        text = result["text"].strip()
        logger.info(f"Transcribed: '{text}'")
        return text
    finally:
        os.unlink(tmp_path)


def transcribe_audio_file(file_path: str) -> str:
    """Transcribe an audio file at a given path."""
    model = get_whisper_model()
    result = model.transcribe(file_path, language="en", fp16=False)
    return result["text"].strip()
