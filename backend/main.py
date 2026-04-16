"""
SilentWitness — FastAPI backend
Offline, privacy-first semantic search for security footage.
"""
import os
import logging
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import FOOTAGE_DIR, THUMBNAILS_DIR, DATA_DIR, COLLECTION_NAME
from db import get_client, ensure_collection, collection_stats
from indexer import index_video, index_all_footage, get_clip_model
from searcher import search, SearchFilters, list_cameras
from searcher_similarity import search_similar
from voice import transcribe_audio_bytes, get_whisper_model
from live import start_live_feed, stop_live_feed, get_live_status

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Track background indexing jobs
indexing_jobs: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: warm up CLIP model and ensure DB collection exists."""
    logger.info("SilentWitness starting up...")
    try:
        client = get_client()
        ensure_collection(client)
        logger.info("VectorAI DB collection ready.")
    except Exception as e:
        logger.warning(f"VectorAI DB not available at startup: {e}. Will retry on first request.")

    # Warm up CLIP and Whisper in background so first use is instant
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, get_clip_model)
    loop.run_in_executor(None, get_whisper_model)

    yield
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
        }
    except Exception as e:
        return {"db_connected": False, "error": str(e)}


# ─── Search ──────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    camera_id: Optional[str] = None
    date: Optional[str] = None           # "YYYY-MM-DD"
    hour_start: Optional[int] = None     # 0-23
    hour_end: Optional[int] = None       # 0-23
    min_motion_score: Optional[float] = None
    limit: int = 20
    group_into_events: bool = True


@app.post("/api/search")
def search_footage(req: SearchRequest):
    """
    Semantic search over indexed footage.
    Text query is embedded with CLIP and compared against frame embeddings.
    Filter DSL narrows results before vector comparison.
    DBSF fusion re-ranks by combining CLIP score + motion score.
    """
    try:
        filters = SearchFilters(
            camera_id=req.camera_id,
            date=req.date,
            hour_start=req.hour_start,
            hour_end=req.hour_end,
            min_motion_score=req.min_motion_score,
        )
        results = search(
            query=req.query,
            filters=filters,
            limit=req.limit,
            group_into_events=req.group_into_events,
        )
        return results
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
    limit: int = 20,
):
    """GET version for quick browser/curl testing."""
    req = SearchRequest(
        query=q,
        camera_id=camera_id,
        date=date,
        hour_start=hour_start,
        hour_end=hour_end,
        min_motion_score=min_motion_score,
        limit=limit,
    )
    return search_footage(req)


# ─── Indexing ─────────────────────────────────────────────────────────────────

class IndexRequest(BaseModel):
    camera_id: Optional[str] = None
    fps_sample: float = 1.0


def _run_index_job(job_id: str, video_path: str, camera_id: Optional[str], fps_sample: float):
    """Background task: index a single video file."""
    indexing_jobs[job_id] = {"status": "running", "video": os.path.basename(video_path)}
    try:
        result = index_video(video_path, camera_id=camera_id, fps_sample=fps_sample)
        indexing_jobs[job_id] = {"status": "done", **result}
    except Exception as e:
        indexing_jobs[job_id] = {"status": "error", "error": str(e)}


@app.post("/api/index/upload")
async def upload_and_index(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: Optional[str] = None,
    fps_sample: float = 1.0,
):
    """Upload a video file and index it in the background."""
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in supported:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {suffix}")

    save_path = os.path.join(FOOTAGE_DIR, file.filename)
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    import uuid as _uuid
    job_id = f"{Path(file.filename).stem}_{_uuid.uuid4().hex[:8]}"
    background_tasks.add_task(_run_index_job, job_id, save_path, camera_id, fps_sample)

    return {"job_id": job_id, "status": "queued", "video": file.filename}


@app.post("/api/index/scan")
def scan_and_index_all(background_tasks: BackgroundTasks, fps_sample: float = 1.0):
    """Scan footage directory and index all videos found."""
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    videos = [
        f for f in os.listdir(FOOTAGE_DIR)
        if Path(f).suffix.lower() in supported
    ]
    if not videos:
        return {"message": "No video files found in footage directory.", "footage_dir": FOOTAGE_DIR}

    job_ids = []
    for fname in videos:
        job_id = f"scan_{fname}"
        path = os.path.join(FOOTAGE_DIR, fname)
        background_tasks.add_task(_run_index_job, job_id, path, None, fps_sample)
        job_ids.append(job_id)
        indexing_jobs[job_id] = {"status": "queued", "video": fname}

    return {"queued": len(job_ids), "job_ids": job_ids}


@app.get("/api/index/jobs")
def get_indexing_jobs():
    """Check status of all indexing jobs."""
    return indexing_jobs


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
    """
    Transcribe audio with local Whisper, then run semantic search.
    Audio is processed entirely on-device — no cloud API calls.
    Accepts: webm, wav, mp3, ogg, m4a
    """
    audio_bytes = await audio.read()
    try:
        text = transcribe_audio_bytes(audio_bytes, mime_type=audio.content_type or "audio/webm")
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
    exclude_same_video: bool = False
    limit: int = 20


@app.post("/api/search/similar")
def search_similar_frames(req: SimilarityRequest):
    """
    Find frames visually similar to an existing indexed frame.
    Uses the stored CLIP vector directly — no text query, no re-embedding.
    The 'find every time this person appeared' feature.
    """
    filters = SearchFilters(
        camera_id=req.camera_id,
        date=req.date,
        hour_start=req.hour_start,
        hour_end=req.hour_end,
        min_motion_score=req.min_motion_score,
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
    Used to render the incident timeline visualization in the frontend.
    """
    try:
        client = get_client()
        # Scroll through all frames and bucket by time
        from collections import defaultdict
        from searcher import build_filter, SearchFilters

        filters = SearchFilters(camera_id=camera_id, date=date)
        db_filter = build_filter(filters)

        buckets = defaultdict(lambda: {"count": 0, "max_motion": 0.0, "frames": []})

        offset = None
        while True:
            scroll_response = client.points.scroll(
                COLLECTION_NAME,
                limit=200,
                offset=offset,
                query_filter=db_filter,
                with_payload=["absolute_time", "motion_score", "camera_id", "thumbnail_path", "timestamp_sec"],
            )
            # SDK may return (results, next_offset) tuple OR a ScrollResult object
            if isinstance(scroll_response, (list, tuple)) and len(scroll_response) == 2:
                results, next_offset = scroll_response
            elif hasattr(scroll_response, "points"):
                results = scroll_response.points
                next_offset = getattr(scroll_response, "next_page_offset", None)
            else:
                results = scroll_response
                next_offset = None
            for point in results:
                p = point.payload
                abs_time = p.get("absolute_time", "")
                if not abs_time:
                    continue
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(abs_time)
                    # Bucket key: floor to bucket_minutes
                    bucket_min = (dt.hour * 60 + dt.minute) // bucket_minutes * bucket_minutes
                    bucket_key = f"{dt.date().isoformat()}T{bucket_min // 60:02d}:{bucket_min % 60:02d}"
                    buckets[bucket_key]["count"] += 1
                    motion = p.get("motion_score", 0.0)
                    if motion > buckets[bucket_key]["max_motion"]:
                        buckets[bucket_key]["max_motion"] = motion
                    if len(buckets[bucket_key]["frames"]) < 3:
                        buckets[bucket_key]["frames"].append({
                            "frame_id": str(point.id),
                            "thumbnail_path": p.get("thumbnail_path"),
                            "timestamp_sec": p.get("timestamp_sec"),
                            "absolute_time": abs_time,
                        })
                except Exception:
                    continue

            if next_offset is None or not results:
                break
            offset = next_offset

        # Sort by bucket key
        sorted_buckets = [
            {"time": k, **v}
            for k, v in sorted(buckets.items())
        ]
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
    source: str = "0"            # "0" = default webcam, or RTSP URL
    camera_id: str = "live"
    fps_sample: float = 1.0
    min_motion_score: float = 0.01


@app.post("/api/live/start")
def live_start(req: LiveStartRequest):
    """Start live webcam indexing in background thread."""
    # Convert string "0" to int for webcam index
    source = int(req.source) if req.source.isdigit() else req.source
    result = start_live_feed(
        source=source,
        camera_id=req.camera_id,
        fps_sample=req.fps_sample,
        min_motion_score=req.min_motion_score,
    )
    return result


@app.post("/api/live/stop")
def live_stop(camera_id: str = Query(default="live", description="Camera ID to stop")):
    """Stop a running live feed indexer."""
    return stop_live_feed(camera_id)


@app.get("/api/live/status")
def live_status():
    """Get status of all live feed indexers."""
    return get_live_status()


# ─── Footage management ────────────────────────────────────────────────────────

@app.get("/api/footage")
def list_footage():
    """List all video files in the footage directory."""
    supported = {".mp4", ".avi", ".mkv", ".mov", ".m4v", ".ts"}
    files = []
    for fname in os.listdir(FOOTAGE_DIR):
        if Path(fname).suffix.lower() in supported:
            path = os.path.join(FOOTAGE_DIR, fname)
            files.append({
                "filename": fname,
                "size_mb": round(os.path.getsize(path) / 1_000_000, 2),
                "path": path,
            })
    return {"footage_dir": FOOTAGE_DIR, "files": files}


@app.get("/api/cameras")
def get_cameras():
    """Return all camera IDs present in the index."""
    try:
        client = get_client()
        return {"cameras": list_cameras(client)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/thumbnail/{frame_id}")
def get_thumbnail(frame_id: str):
    """Serve a frame thumbnail by frame ID."""
    thumb_path = os.path.join(THUMBNAILS_DIR, f"{frame_id}.jpg")
    if not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(thumb_path, media_type="image/jpeg")
