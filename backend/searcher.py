"""
Search pipeline: text/image query → CLIP embed → VectorAI DB search
with Filter DSL + DBSF score fusion for temporally-aware results.
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from actian_vectorai import VectorAIClient
from actian_vectorai.models import Field, FilterBuilder

from config import COLLECTION_NAME
from db import get_client
from indexer import embed_text

logger = logging.getLogger(__name__)


@dataclass
class SearchFilters:
    camera_id: Optional[str] = None        # e.g. "cam1"
    date: Optional[str] = None             # e.g. "2025-01-15"
    hour_start: Optional[int] = None       # 0-23
    hour_end: Optional[int] = None         # 0-23
    min_motion_score: Optional[float] = None  # 0.0–1.0


@dataclass
class SearchResult:
    frame_id: str
    score: float
    camera_id: str
    video_file: str
    timestamp_sec: float
    absolute_time: str
    motion_score: float
    thumbnail_path: str
    hour: int
    date: str


def build_filter(filters: SearchFilters):
    """Build VectorAI DB Filter DSL from SearchFilters."""
    if not filters:
        return None

    conditions = []

    if filters.camera_id:
        conditions.append(Field("camera_id").eq(filters.camera_id))

    if filters.date:
        conditions.append(Field("date").eq(filters.date))

    if filters.hour_start is not None and filters.hour_end is not None:
        # Use explicit gte + lte instead of .between() which may not exist in beta SDK
        conditions.append(Field("hour").gte(filters.hour_start))
        conditions.append(Field("hour").lte(filters.hour_end))
    elif filters.hour_start is not None:
        conditions.append(Field("hour").gte(filters.hour_start))
    elif filters.hour_end is not None:
        conditions.append(Field("hour").lte(filters.hour_end))

    if filters.min_motion_score is not None:
        conditions.append(Field("motion_score").gte(filters.min_motion_score))

    if not conditions:
        return None

    builder = FilterBuilder()
    for condition in conditions:
        builder = builder.must(condition)
    return builder.build()


def dbsf_fusion(
    semantic_results: list,
    motion_boost_weight: float = 0.15,
) -> list[SearchResult]:
    """
    Distribution-Based Score Fusion:
    Final score = CLIP_score * (1 - motion_weight) + motion_score * motion_weight

    This boosts frames with significant activity, making results
    both semantically relevant and temporally interesting.
    """
    fused = []
    for hit in semantic_results:
        payload = hit.payload
        clip_score = hit.score  # cosine similarity from VectorAI DB (0-1)
        motion_score = payload.get("motion_score", 0.0)

        # DBSF: weighted combination of semantic + motion signal
        fused_score = (clip_score * (1 - motion_boost_weight)) + (motion_score * motion_boost_weight)

        fused.append(SearchResult(
            frame_id=str(hit.id),
            score=round(fused_score, 4),
            camera_id=payload.get("camera_id", "unknown"),
            video_file=payload.get("video_file", ""),
            timestamp_sec=payload.get("timestamp_sec", 0.0),
            absolute_time=payload.get("absolute_time", ""),
            motion_score=motion_score,
            thumbnail_path=payload.get("thumbnail_path", ""),
            hour=payload.get("hour", 0),
            date=payload.get("date", ""),
        ))

    # Re-sort by fused score descending
    fused.sort(key=lambda x: x.score, reverse=True)
    return fused


def cluster_into_events(results: list[SearchResult], gap_sec: float = 10.0) -> list[dict]:
    """
    Group consecutive frames within gap_sec of each other into "events."
    Groups by (camera_id, video_file) first, then by time proximity within that group.
    This prevents live frames (Unix epoch timestamps) from clustering with pre-recorded frames.
    """
    if not results:
        return []

    # Group by (camera_id, video_file) to prevent cross-video time collisions
    from collections import defaultdict
    video_groups: dict[tuple, list[SearchResult]] = defaultdict(list)
    for r in results:
        video_groups[(r.camera_id, r.video_file)].append(r)

    all_events = []
    for (cam, vid), group in video_groups.items():
        # Sort by timestamp within this video
        sorted_results = sorted(group, key=lambda x: x.timestamp_sec)
        events = []
        current_event = [sorted_results[0]]

        for result in sorted_results[1:]:
            prev_time = current_event[-1].timestamp_sec
            if result.timestamp_sec - prev_time <= gap_sec:
                current_event.append(result)
            else:
                events.append(_make_event(current_event))
                current_event = [result]

        events.append(_make_event(current_event))
        all_events.extend(events)

    # Sort all events globally by best score
    all_events.sort(key=lambda e: e["best_score"], reverse=True)
    return all_events


def _make_event(frames: list[SearchResult]) -> dict:
    best_frame = max(frames, key=lambda f: f.score)
    return {
        "event_id": f"{best_frame.camera_id}_{best_frame.timestamp_sec:.0f}",
        "camera_id": best_frame.camera_id,
        "best_score": best_frame.score,
        "start_sec": frames[0].timestamp_sec,
        "end_sec": frames[-1].timestamp_sec,
        "duration_sec": round(frames[-1].timestamp_sec - frames[0].timestamp_sec, 1),
        "start_time": frames[0].absolute_time,
        "end_time": frames[-1].absolute_time,
        "frame_count": len(frames),
        "thumbnail_path": best_frame.thumbnail_path,
        "video_file": best_frame.video_file,
        "frames": [
            {
                "frame_id": f.frame_id,
                "score": f.score,
                "timestamp_sec": f.timestamp_sec,
                "absolute_time": f.absolute_time,
                "motion_score": f.motion_score,
                "thumbnail_path": f.thumbnail_path,
            }
            for f in sorted(frames, key=lambda x: x.score, reverse=True)
        ],
    }


def search(
    query: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
    group_into_events: bool = True,
    client: Optional[VectorAIClient] = None,
) -> dict:
    """
    Main search entry point.

    1. Embed query text with CLIP
    2. Apply Filter DSL (camera, time window, motion threshold)
    3. Vector search in VectorAI DB
    4. DBSF fusion with motion score
    5. Cluster into events
    """
    if client is None:
        client = get_client()

    logger.info(f"Searching: '{query}' | filters={filters} | limit={limit}")

    # Step 1: CLIP text embedding
    query_vector = embed_text(query)

    # Step 2: Build filter
    db_filter = build_filter(filters) if filters else None

    # Step 3: VectorAI DB semantic search
    raw_results = client.points.search(
        COLLECTION_NAME,
        vector=query_vector,
        limit=limit * 2,  # fetch more, DBSF re-ranks
        query_filter=db_filter,
        with_payload=True,
    )

    # Step 4: DBSF fusion
    fused = dbsf_fusion(raw_results)
    fused = fused[:limit]  # trim after re-ranking

    if not fused:
        return {"query": query, "total_results": 0, "events": [], "frames": []}

    # Step 5: Cluster into events (optional)
    if group_into_events:
        events = cluster_into_events(fused)
        return {
            "query": query,
            "total_results": len(fused),
            "total_events": len(events),
            "events": events,
            "frames": [vars(f) for f in fused],
        }
    else:
        return {
            "query": query,
            "total_results": len(fused),
            "events": [],
            "frames": [vars(f) for f in fused],
        }


def list_cameras(client: Optional[VectorAIClient] = None) -> list[str]:
    """Return all unique camera IDs in the index."""
    if client is None:
        client = get_client()
    # Scroll through all points to collect unique camera IDs
    camera_ids = set()
    offset = None
    while True:
        scroll_response = client.points.scroll(
            COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=["camera_id"],
        )
        # Handle both (list, offset) tuple and ScrollResult object
        if isinstance(scroll_response, (list, tuple)) and len(scroll_response) == 2:
            results, next_offset = scroll_response
        elif hasattr(scroll_response, "points"):
            results = scroll_response.points
            next_offset = getattr(scroll_response, "next_page_offset", None)
        else:
            results = scroll_response
            next_offset = None
        for point in results:
            camera_ids.add(point.payload.get("camera_id", "unknown"))
        if next_offset is None or not results:
            break
        offset = next_offset
    return sorted(list(camera_ids))
