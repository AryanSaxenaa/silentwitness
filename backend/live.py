"""
Live webcam feed indexer.
Motion-gated: only embeds frames when OpenCV detects activity.
Runs in a background thread — new frames are searchable within seconds of capture.

RAM strategy (fits 8GB):
- CLIP model is shared singleton from indexer.py
- Frame queue is bounded (max 10 frames) — drops if indexer falls behind
- Only motion frames hit CLIP — idle camera = zero GPU/CPU load
"""

import logging
import queue
import threading
import time
import uuid
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from config import COLLECTION_NAME, THUMBNAILS_DIR
from db import ensure_collection, get_client
from indexer import embed_frame, save_thumbnail
from motion import compute_motion_score

try:
    # Preferred import path in newer SDK builds
    from actian_vectorai import PointStruct
except ImportError:
    # Backward-compatible fallback for older SDK builds
    from actian_vectorai.models import PointStruct

logger = logging.getLogger(__name__)


class LiveIndexer:
    """
    Manages a background thread that:
    1. Captures frames from a webcam (or RTSP stream)
    2. Computes motion score via frame differencing
    3. Embeds motion frames with CLIP
    4. Upserts to VectorAI DB in real time
    """

    def __init__(
        self,
        source: int | str = 0,  # 0 = default webcam, or RTSP URL / file path
        camera_id: str = "live",
        fps_sample: float = 1.0,
        min_motion_score: float = 0.01,
        queue_size: int = 10,
    ):
        self.source = source
        self.camera_id = camera_id
        self.fps_sample = fps_sample
        self.min_motion_score = min_motion_score

        self._frame_queue: queue.Queue = queue.Queue(maxsize=queue_size)
        self._capture_thread: Optional[threading.Thread] = None
        self._index_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        self.frames_captured = 0
        self.frames_indexed = 0
        self.frames_dropped = 0
        self.running = False
        self.error: Optional[str] = None

    # ── Public interface ────────────────────────────────────────────────────

    def start(self):
        if self.running:
            return
        self._stop_event.clear()
        self.running = True
        self.error = None

        self._capture_thread = threading.Thread(
            target=self._capture_loop, daemon=True, name="sw-capture"
        )
        self._index_thread = threading.Thread(
            target=self._index_loop, daemon=True, name="sw-indexer"
        )
        self._capture_thread.start()
        self._index_thread.start()
        logger.info(
            f"LiveIndexer started: source={self.source}, camera={self.camera_id}"
        )

    def stop(self):
        self._stop_event.set()
        self.running = False
        # Drain queue so index thread unblocks
        while not self._frame_queue.empty():
            try:
                self._frame_queue.get_nowait()
            except queue.Empty:
                break
        logger.info("LiveIndexer stopped.")

    def status(self) -> dict:
        return {
            "running": self.running,
            "source": str(self.source),
            "camera_id": self.camera_id,
            "frames_captured": self.frames_captured,
            "frames_indexed": self.frames_indexed,
            "frames_dropped": self.frames_dropped,
            "error": self.error,
        }

    # ── Internal loops ──────────────────────────────────────────────────────

    MAX_RECONNECT_ATTEMPTS = 10

    def _capture_loop(self):
        """Capture frames from webcam / stream, apply motion gate, enqueue."""
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            self.error = f"Cannot open video source: {self.source}"
            self.running = False
            logger.error(self.error)
            return

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(video_fps / self.fps_sample))
        frame_idx = 0
        prev_gray = None
        reconnect_count = 0

        logger.info(f"Capture loop: fps={video_fps:.1f}, interval={frame_interval}")

        while not self._stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                # Stream ended or camera disconnected — retry with backoff
                reconnect_count += 1
                if reconnect_count > self.MAX_RECONNECT_ATTEMPTS:
                    self.error = f"Video source lost after {self.MAX_RECONNECT_ATTEMPTS} reconnect attempts"
                    self.running = False
                    logger.error(self.error)
                    break
                backoff = min(reconnect_count * 1.0, 10.0)  # max 10s backoff
                logger.warning(
                    f"Frame read failed (attempt {reconnect_count}/{self.MAX_RECONNECT_ATTEMPTS}), retrying in {backoff:.0f}s..."
                )
                time.sleep(backoff)
                cap.release()
                cap = cv2.VideoCapture(self.source)
                frame_idx = 0
                prev_gray = None
                continue
            reconnect_count = 0  # reset on successful read

            if frame_idx % frame_interval == 0:
                curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                timestamp = datetime.now()

                if prev_gray is not None:
                    motion = compute_motion_score(prev_gray, curr_gray)
                    if motion >= self.min_motion_score:
                        item = (frame.copy(), timestamp, motion)
                        try:
                            self._frame_queue.put_nowait(item)
                            self.frames_captured += 1
                        except queue.Full:
                            self.frames_dropped += 1
                            logger.debug("Frame queue full — dropped frame")

                prev_gray = curr_gray

            frame_idx += 1

        cap.release()

    def _index_loop(self):
        """Pull frames from queue, embed with CLIP, upsert to VectorAI DB."""
        try:
            client = get_client()
            ensure_collection(client)
        except Exception as e:
            self.error = f"VectorAI DB connection failed: {e}"
            logger.error(self.error)
            return

        logger.info("Index loop started.")

        while not self._stop_event.is_set() or not self._frame_queue.empty():
            try:
                frame_bgr, timestamp, motion_score = self._frame_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            try:
                frame_id = str(uuid.uuid4())
                vector = embed_frame(frame_bgr)
                thumb_path = save_thumbnail(frame_bgr, frame_id)

                point = PointStruct(
                    id=frame_id,
                    vector=vector,
                    payload={
                        "camera_id": self.camera_id,
                        "video_file": f"live:{self.camera_id}",
                        "timestamp_sec": timestamp.timestamp(),
                        "absolute_time": timestamp.isoformat(),
                        "hour": timestamp.hour,
                        "date": timestamp.date().isoformat(),
                        "motion_score": motion_score,
                        "thumbnail_path": thumb_path,
                        "frame_index": self.frames_indexed,
                        "is_live": True,
                    },
                )
                client.points.upsert(COLLECTION_NAME, [point])
                self.frames_indexed += 1
                logger.debug(
                    f"Live frame indexed: {frame_id} motion={motion_score:.3f}"
                )

            except Exception as e:
                logger.error(f"Failed to index live frame: {e}")


# ── Global registry of live indexers (one per camera source) ────────────────

_live_indexers: dict[str, LiveIndexer] = {}
_registry_lock = threading.Lock()


def start_live_feed(
    source: int | str = 0,
    camera_id: str = "live",
    fps_sample: float = 1.0,
    min_motion_score: float = 0.01,
) -> dict:
    with _registry_lock:
        if camera_id in _live_indexers and _live_indexers[camera_id].running:
            return {"status": "already_running", **_live_indexers[camera_id].status()}

        indexer = LiveIndexer(
            source=source,
            camera_id=camera_id,
            fps_sample=fps_sample,
            min_motion_score=min_motion_score,
        )
        indexer.start()
        _live_indexers[camera_id] = indexer
        return {"status": "started", **indexer.status()}


def stop_live_feed(camera_id: str = "live") -> dict:
    with _registry_lock:
        if camera_id not in _live_indexers:
            return {"status": "not_found"}
        _live_indexers[camera_id].stop()
        return {"status": "stopped", **_live_indexers[camera_id].status()}


def get_live_status() -> dict:
    with _registry_lock:
        return {cid: idx.status() for cid, idx in _live_indexers.items()}
