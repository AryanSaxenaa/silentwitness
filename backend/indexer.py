"""
Indexer: extracts frames from video, embeds with CLIP, upserts to VectorAI DB.
Motion-gated: only frames with significant activity are indexed.
"""
import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta

import cv2
import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer
from actian_vectorai.models import PointStruct

from config import (
    CLIP_MODEL, CLIP_DIM, COLLECTION_NAME,
    THUMBNAILS_DIR, FRAME_RATE, FOOTAGE_DIR
)
from db import get_client, ensure_collection
from motion import extract_motion_frames

logger = logging.getLogger(__name__)

# Load CLIP once at module level — shared across all indexing calls
_clip_model: SentenceTransformer | None = None


def get_clip_model() -> SentenceTransformer:
    global _clip_model
    if _clip_model is None:
        logger.info(f"Loading CLIP model: {CLIP_MODEL}")
        _clip_model = SentenceTransformer(CLIP_MODEL)
    return _clip_model


def embed_frame(frame_bgr: np.ndarray) -> list[float]:
    """Convert a BGR OpenCV frame to a CLIP embedding."""
    model = get_clip_model()
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(frame_rgb)
    embedding = model.encode(pil_img, convert_to_numpy=True)
    return embedding.tolist()


def embed_text(text: str) -> list[float]:
    """Convert a text query to a CLIP embedding (same space as images)."""
    model = get_clip_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def save_thumbnail(frame_bgr: np.ndarray, frame_id: str, size: tuple = (320, 180)) -> str:
    """Save a JPEG thumbnail and return its relative path."""
    thumb_path = os.path.join(THUMBNAILS_DIR, f"{frame_id}.jpg")
    resized = cv2.resize(frame_bgr, size, interpolation=cv2.INTER_AREA)
    cv2.imwrite(thumb_path, resized, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return thumb_path


def parse_recording_start(filename: str) -> datetime | None:
    """
    Try to parse recording start time from filename.
    Supports formats: cam1_20250115_143022.mp4, 2025-01-15T14:30:22.mp4
    Falls back to file modification time.
    """
    import re
    stem = Path(filename).stem

    # Try YYYYMMDD_HHMMSS
    match = re.search(r'(\d{8})_(\d{6})', stem)
    if match:
        try:
            return datetime.strptime(match.group(1) + match.group(2), "%Y%m%d%H%M%S")
        except ValueError:
            pass

    # Try ISO format
    match = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})', stem)
    if match:
        try:
            return datetime.fromisoformat(match.group(1))
        except ValueError:
            pass

    return None


def extract_camera_id(filename: str) -> str:
    """Extract camera ID from filename like cam1_, camera_2_, ch01_, etc."""
    import re
    match = re.search(r'(?:cam|camera|ch|channel)[_-]?(\d+)', Path(filename).stem, re.IGNORECASE)
    if match:
        return f"cam{match.group(1)}"
    return "cam1"  # default


def index_video(
    video_path: str,
    camera_id: str | None = None,
    recording_start: datetime | None = None,
    fps_sample: float = FRAME_RATE,
    batch_size: int = 32,
    progress_callback=None,
) -> dict:
    """
    Full pipeline: extract motion frames → embed with CLIP → upsert to VectorAI DB.

    Returns summary dict with counts.
    """
    filename = os.path.basename(video_path)
    camera_id = camera_id or extract_camera_id(filename)
    recording_start = recording_start or parse_recording_start(filename) or datetime.now()

    client = get_client()
    ensure_collection(client)

    points_batch = []
    total_frames = 0
    indexed_frames = 0

    logger.info(f"Starting indexing: {filename} | camera={camera_id} | fps={fps_sample}")

    for sampled_idx, timestamp_sec, frame_bgr, motion_score in extract_motion_frames(
        video_path, fps_sample=fps_sample
    ):
        total_frames += 1
        frame_id = str(uuid.uuid4())
        absolute_time = recording_start + timedelta(seconds=timestamp_sec)

        # Save thumbnail
        thumb_path = save_thumbnail(frame_bgr, frame_id)

        # CLIP embedding
        vector = embed_frame(frame_bgr)

        point = PointStruct(
            id=frame_id,
            vector=vector,
            payload={
                "camera_id": camera_id,
                "video_file": filename,
                "timestamp_sec": round(timestamp_sec, 2),
                "absolute_time": absolute_time.isoformat(),
                "hour": absolute_time.hour,
                "date": absolute_time.date().isoformat(),
                "motion_score": motion_score,
                "thumbnail_path": thumb_path,
                "frame_index": sampled_idx,
            },
        )
        points_batch.append(point)
        indexed_frames += 1

        # Upsert in batches
        if len(points_batch) >= batch_size:
            client.points.upsert(COLLECTION_NAME, points_batch)
            logger.info(f"  Upserted batch of {len(points_batch)} frames")
            if progress_callback:
                progress_callback(indexed_frames)
            points_batch = []

    # Flush remaining
    if points_batch:
        client.points.upsert(COLLECTION_NAME, points_batch)
        logger.info(f"  Upserted final batch of {len(points_batch)} frames")
        if progress_callback:
            progress_callback(indexed_frames)

    logger.info(
        f"Done: {filename} | total_sampled={total_frames} | indexed={indexed_frames}"
    )
    return {
        "video": filename,
        "camera_id": camera_id,
        "total_frames_sampled": total_frames,
        "frames_indexed": indexed_frames,
        "recording_start": recording_start.isoformat(),
    }


def index_all_footage(fps_sample: float = FRAME_RATE) -> list[dict]:
    """Index all video files in FOOTAGE_DIR."""
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    results = []
    for fname in sorted(os.listdir(FOOTAGE_DIR)):
        if Path(fname).suffix.lower() in supported:
            video_path = os.path.join(FOOTAGE_DIR, fname)
            try:
                result = index_video(video_path, fps_sample=fps_sample)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to index {fname}: {e}")
                results.append({"video": fname, "error": str(e)})
    return results
