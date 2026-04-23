"""
SilentWitness — FastAPI backend
Offline, privacy-first semantic search for security footage.
"""

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from config import COLLECTION_NAME, FOOTAGE_DIR, THUMBNAILS_DIR
from db import close_client, collection_stats, ensure_collection, get_client, recreate_collection
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from indexer import get_clip_model, index_video
from live import get_live_status, start_live_feed, stop_live_feed
from pydantic import BaseModel
from searcher import SearchFilters, build_filter, list_cameras, search
from searcher_similarity import search_similar
from voice import get_whisper_model, transcribe_audio_bytes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Track background indexing jobs
indexing_jobs: dict[str, dict] = {}
runtime_health: dict[str, Any] = {
    "retrieval_sanity": {
        "checked_at": None,
        "ok": None,
        "reason": "not_checked",
        "sample_frame_id": None,
        "similar_results": 0,
    },
    "last_index_job": None,
}


def _parse_scroll_response(scroll_response: Any) -> tuple[list[Any], Any]:
    """
    Normalize SDK scroll response variants:
    - (points, next_offset)
    - object with .points and .next_page_offset
    - plain list of points
    """
    if isinstance(scroll_response, tuple) and len(scroll_response) == 2:
        points, next_offset = scroll_response
        if isinstance(points, list):
            return points, next_offset
        try:
            return list(points) if points is not None else [], next_offset
        except Exception:
            return [], next_offset

    points_attr = getattr(scroll_response, "points", None)
    if isinstance(points_attr, list):
        return points_attr, getattr(scroll_response, "next_page_offset", None)

    if isinstance(scroll_response, list):
        return scroll_response, None

    if scroll_response is None:
        return [], None

    try:
        return list(scroll_response), None
    except Exception:
        return [], None


def _startup_db() -> None:
    """Blocking DB startup — run inside a thread, never in the event loop."""
    client = get_client()
    ensure_collection(client)


def _run_retrieval_sanity_check() -> dict[str, Any]:
    """
    Verify the indexed collection can retrieve neighbors for a stored frame.
    This catches broken collection/index states where points exist but search returns no hits.
    """
    from datetime import datetime

    result = {
        "checked_at": datetime.utcnow().isoformat() + "Z",
        "ok": None,
        "reason": "not_checked",
        "sample_frame_id": None,
        "similar_results": 0,
    }

    try:
        client = get_client()
        stats = collection_stats(client)
        total_frames = int(stats.get("total_frames", 0) or 0)
        if total_frames < 2:
            result["ok"] = True
            result["reason"] = "not_enough_frames_for_neighbor_check"
            return result

        scroll_response = client.points.scroll(
            COLLECTION_NAME,
            limit=1,
            with_payload=True,
        )
        points, _ = _parse_scroll_response(scroll_response)
        if not points:
            result["ok"] = False
            result["reason"] = "collection_has_no_scrollable_points"
            return result

        frame_id = str(getattr(points[0], "id", ""))
        result["sample_frame_id"] = frame_id
        similar = search_similar(frame_id=frame_id, limit=3)
        similar_results = int(similar.get("total_results", 0) or 0)
        result["similar_results"] = similar_results
        result["ok"] = similar_results > 0
        result["reason"] = "ok" if similar_results > 0 else "similarity_search_returned_zero_results"
        return result
    except Exception as exc:
        result["ok"] = False
        result["reason"] = f"sanity_check_failed: {exc}"
        return result


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm up models and ensure DB collection exists."""
    logger.info("SilentWitness starting up...")

    # Run blocking DB connect/ensure_collection in a thread so the
    # async event loop is never blocked during startup.
    try:
        await asyncio.to_thread(_startup_db)
        logger.info("VectorAI DB collection ready.")
    except Exception as e:
        logger.warning(
            f"VectorAI DB not available at startup: {e}. Will retry on first request."
        )

    # Warm up CLIP and Whisper in background so first request is instant.
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, get_clip_model)
    loop.run_in_executor(None, get_whisper_model)
    runtime_health["retrieval_sanity"] = await asyncio.to_thread(_run_retrieval_sanity_check)

    yield
    await asyncio.to_thread(close_client)
    logger.info("SilentWitness shutting down.")


app = FastAPI(
    title="SilentWitness API",
    description="Offline semantic search for security footage powered by Actian VectorAI DB + CLIP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve thumbnails as static files
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=THUMBNAILS_DIR), name="thumbnails")


# ─── Health & Status ─────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "service": "silentwitness"}


@app.get("/api/status")
def status():
    try:
        client = get_client()
        stats = collection_stats(client)
        cameras = list_cameras(client)
        return {
            "db_connected": True,
            "stats": stats,
            "cameras": cameras,
            "runtime_health": runtime_health,
        }
    except Exception as e:
        return {"db_connected": False, "error": str(e), "runtime_health": runtime_health}


# ─── Search ──────────────────────────────────────────────────────────────────


class SearchRequest(BaseModel):
    query: str
    camera_id: Optional[str] = None
    date: Optional[str] = None
    hour_start: Optional[int] = None
    hour_end: Optional[int] = None
    min_motion_score: Optional[float] = None
    ocr_text: Optional[str] = None
    limit: int = 20
    group_into_events: bool = True


@app.post("/api/search")
def search_footage(req: SearchRequest):
    try:
        filters = SearchFilters(
            camera_id=req.camera_id,
            date=req.date,
            hour_start=req.hour_start,
            hour_end=req.hour_end,
            min_motion_score=req.min_motion_score,
            ocr_text=req.ocr_text,
        )
        return search(
            query=req.query,
            filters=filters,
            limit=req.limit,
            group_into_events=req.group_into_events,
        )
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search")
def search_footage_get(
    q: str = Query(..., description="Natural language search query"),
    camera_id: Optional[str] = None,
    date: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    min_motion_score: Optional[float] = None,
    ocr_text: Optional[str] = None,
    limit: int = 20,
):
    req = SearchRequest(
        query=q,
        camera_id=camera_id,
        date=date,
        hour_start=hour_start,
        hour_end=hour_end,
        min_motion_score=min_motion_score,
        ocr_text=ocr_text,
        limit=limit,
    )
    return search_footage(req)


# ─── Indexing ─────────────────────────────────────────────────────────────────


def _run_index_job(
    job_id: str, video_path: str, camera_id: Optional[str], fps_sample: float
):
    indexing_jobs[job_id] = {"status": "running", "video": os.path.basename(video_path)}
    try:
        result = index_video(video_path, camera_id=camera_id, fps_sample=fps_sample)
        indexing_jobs[job_id] = {"status": "done", **result}
        runtime_health["last_index_job"] = {
            "job_id": job_id,
            "status": "done",
            **result,
        }
        runtime_health["retrieval_sanity"] = _run_retrieval_sanity_check()
    except Exception as e:
        indexing_jobs[job_id] = {"status": "error", "error": str(e)}
        runtime_health["last_index_job"] = {
            "job_id": job_id,
            "status": "error",
            "video": os.path.basename(video_path),
            "error": str(e),
        }


@app.post("/api/index/upload")
async def upload_and_index(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: Optional[str] = None,
    fps_sample: float = 1.0,
):
    """
    Upload a video file and index it in the background.

    Fix: optional upload metadata handling
    - `file.filename` can be None in some clients; we now handle that safely.
    """
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}

    filename = file.filename or "upload.mp4"
    safe_name = os.path.basename(filename).strip() or "upload.mp4"
    suffix = Path(safe_name).suffix.lower()

    if suffix not in supported:
        raise HTTPException(
            status_code=400, detail=f"Unsupported format: {suffix or 'unknown'}"
        )

    os.makedirs(FOOTAGE_DIR, exist_ok=True)
    save_path = os.path.join(FOOTAGE_DIR, safe_name)
    if os.path.exists(save_path):
        stem = Path(safe_name).stem
        suffix = Path(safe_name).suffix
        save_path = os.path.join(FOOTAGE_DIR, f"{stem}_{uuid.uuid4().hex[:8]}{suffix}")
        safe_name = os.path.basename(save_path)

    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    import uuid as _uuid

    job_id = f"{Path(safe_name).stem}_{_uuid.uuid4().hex[:8]}"
    background_tasks.add_task(_run_index_job, job_id, save_path, camera_id, fps_sample)

    return {"job_id": job_id, "status": "queued", "video": safe_name}


@app.post("/api/index/scan")
def scan_and_index_all(background_tasks: BackgroundTasks, fps_sample: float = 1.0):
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    videos = [f for f in os.listdir(FOOTAGE_DIR) if Path(f).suffix.lower() in supported]
    if not videos:
        return {
            "message": "No video files found in footage directory.",
            "footage_dir": FOOTAGE_DIR,
        }

    job_ids = []
    for fname in videos:
        job_id = f"scan_{Path(fname).stem}_{uuid.uuid4().hex[:8]}"
        path = os.path.join(FOOTAGE_DIR, fname)
        background_tasks.add_task(_run_index_job, job_id, path, None, fps_sample)
        job_ids.append(job_id)
        indexing_jobs[job_id] = {"status": "queued", "video": fname}

    return {"queued": len(job_ids), "job_ids": job_ids}


@app.get("/api/index/jobs")
def get_indexing_jobs():
    return indexing_jobs


@app.post("/api/index/rebuild")
def rebuild_index(background_tasks: BackgroundTasks, fps_sample: float = 1.0):
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    videos = [f for f in os.listdir(FOOTAGE_DIR) if Path(f).suffix.lower() in supported]
    if not videos:
        return {
            "message": "No video files found in footage directory.",
            "footage_dir": FOOTAGE_DIR,
        }

    client = get_client()
    recreate_collection(client)
    indexing_jobs.clear()
    runtime_health["retrieval_sanity"] = {
        "checked_at": None,
        "ok": None,
        "reason": "rebuild_in_progress",
        "sample_frame_id": None,
        "similar_results": 0,
    }

    job_ids = []
    for fname in videos:
        job_id = f"rebuild_{Path(fname).stem}_{uuid.uuid4().hex[:8]}"
        path = os.path.join(FOOTAGE_DIR, fname)
        background_tasks.add_task(_run_index_job, job_id, path, None, fps_sample)
        job_ids.append(job_id)
        indexing_jobs[job_id] = {"status": "queued", "video": fname}

    return {"queued": len(job_ids), "job_ids": job_ids, "collection": COLLECTION_NAME}


@app.get("/api/index/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in indexing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return indexing_jobs[job_id]


# ─── Voice query ────────────────────────────────────────────────────────────────


@app.post("/api/voice")
async def voice_query(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    camera_id: Optional[str] = None,
    date: Optional[str] = None,
    hour_start: Optional[int] = None,
    hour_end: Optional[int] = None,
    min_motion_score: Optional[float] = None,
    limit: int = 20,
):
    audio_bytes = await audio.read()
    try:
        text = transcribe_audio_bytes(
            audio_bytes, mime_type=audio.content_type or "audio/webm"
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Transcription failed: {e}")

    if not text:
        raise HTTPException(status_code=422, detail="No speech detected in audio")

    filters = SearchFilters(
        camera_id=camera_id,
        date=date,
        hour_start=hour_start,
        hour_end=hour_end,
        min_motion_score=min_motion_score,
    )
    results = search(query=text, filters=filters, limit=limit, group_into_events=True)
    return {"transcribed_query": text, **results}


# ─── Similarity search ────────────────────────────────────────────────────────


class SimilarityRequest(BaseModel):
    frame_id: str
    camera_id: Optional[str] = None
    date: Optional[str] = None
    hour_start: Optional[int] = None
    hour_end: Optional[int] = None
    min_motion_score: Optional[float] = None
    ocr_text: Optional[str] = None
    exclude_same_video: bool = False
    limit: int = 20


@app.post("/api/search/similar")
def search_similar_frames(req: SimilarityRequest):
    filters = SearchFilters(
        camera_id=req.camera_id,
        date=req.date,
        hour_start=req.hour_start,
        hour_end=req.hour_end,
        min_motion_score=req.min_motion_score,
        ocr_text=req.ocr_text,
    )
    try:
        return search_similar(
            frame_id=req.frame_id,
            filters=filters,
            limit=req.limit,
            exclude_same_video=req.exclude_same_video,
        )
    except Exception as e:
        logger.error(f"Similarity search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Timeline / activity heatmap ─────────────────────────────────────────────


@app.get("/api/timeline")
def get_timeline(
    camera_id: Optional[str] = None,
    date: Optional[str] = None,
    bucket_minutes: int = 5,
):
    """
    Returns activity heatmap data: frame counts bucketed by time.
    Fix: stabilized timeline scroll typing/parsing for SDK response variants.
    """
    try:
        client = get_client()
        filters = SearchFilters(camera_id=camera_id, date=date)
        db_filter = build_filter(filters)

        from collections import defaultdict
        from datetime import datetime

        buckets: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"count": 0, "max_motion": 0.0, "frames": []}
        )

        offset = None
        while True:
            scroll_response = client.points.scroll(
                COLLECTION_NAME,
                limit=200,
                offset=offset,
                filter=db_filter,
                with_payload=True,
            )

            points, next_offset = _parse_scroll_response(scroll_response)
            if not points:
                break

            for point in points:
                payload = getattr(point, "payload", {}) or {}
                if not isinstance(payload, dict):
                    continue

                abs_time = payload.get("absolute_time", "")
                if not abs_time:
                    continue

                try:
                    dt = datetime.fromisoformat(str(abs_time))
                except Exception:
                    continue

                bucket_min = (
                    (dt.hour * 60 + dt.minute) // bucket_minutes
                ) * bucket_minutes
                bucket_key = f"{dt.date().isoformat()}T{bucket_min // 60:02d}:{bucket_min % 60:02d}"

                bucket = buckets[bucket_key]
                bucket["count"] = int(bucket.get("count", 0)) + 1

                motion = float(payload.get("motion_score", 0.0) or 0.0)
                if motion > float(bucket.get("max_motion", 0.0) or 0.0):
                    bucket["max_motion"] = motion

                frames_list = bucket.get("frames")
                if isinstance(frames_list, list) and len(frames_list) < 3:
                    frames_list.append(
                        {
                            "frame_id": str(getattr(point, "id", "")),
                            "thumbnail_path": payload.get("thumbnail_path"),
                            "timestamp_sec": payload.get("timestamp_sec"),
                            "absolute_time": str(abs_time),
                        }
                    )

            if next_offset is None:
                break
            offset = next_offset

        sorted_buckets = [{"time": k, **v} for k, v in sorted(buckets.items())]
        return {
            "camera_id": camera_id,
            "date": date,
            "bucket_minutes": bucket_minutes,
            "total_buckets": len(sorted_buckets),
            "timeline": sorted_buckets,
        }

    except Exception as e:
        logger.error(f"Timeline failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Live webcam feed ─────────────────────────────────────────────────────────


class LiveStartRequest(BaseModel):
    source: str = "0"
    camera_id: str = "live"
    fps_sample: float = 1.0
    min_motion_score: float = 0.01


@app.post("/api/live/start")
def live_start(req: LiveStartRequest):
    source = int(req.source) if req.source.isdigit() else req.source
    return start_live_feed(
        source=source,
        camera_id=req.camera_id,
        fps_sample=req.fps_sample,
        min_motion_score=req.min_motion_score,
    )


@app.post("/api/live/stop")
def live_stop(camera_id: str = Query(default="live", description="Camera ID to stop")):
    return stop_live_feed(camera_id)


@app.get("/api/live/status")
def live_status():
    return get_live_status()


# ─── Footage management ────────────────────────────────────────────────────────


@app.get("/api/footage")
def list_footage():
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    files = []
    for fname in os.listdir(FOOTAGE_DIR):
        if Path(fname).suffix.lower() in supported:
            path = os.path.join(FOOTAGE_DIR, fname)
            files.append(
                {
                    "filename": fname,
                    "size_mb": round(os.path.getsize(path) / 1_000_000, 2),
                    "path": path,
                }
            )
    return {"footage_dir": FOOTAGE_DIR, "files": files}


@app.get("/api/cameras")
def get_cameras():
    try:
        client = get_client()
        return {"cameras": list_cameras(client)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/thumbnail/{frame_id}")
def get_thumbnail(frame_id: str):
    thumb_path = os.path.join(THUMBNAILS_DIR, f"{frame_id}.jpg")
    if not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(thumb_path, media_type="image/jpeg")
