"""
Search pipeline: text/image query -> CLIP embed -> VectorAI DB search
with Filter DSL + motion-aware score fusion for temporally-aware results.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Iterable, Optional

try:
    from actian_vectorai import Field, FilterBuilder, VectorAIClient
except ImportError:
    from actian_vectorai import VectorAIClient
    from actian_vectorai.models import Field, FilterBuilder
from config import COLLECTION_NAME
from db import get_client
from indexer import embed_text

logger = logging.getLogger(__name__)


@dataclass
class SearchFilters:
    camera_id: Optional[str] = None  # e.g. "cam1"
    date: Optional[str] = None  # e.g. "2026-04-13"
    hour_start: Optional[int] = None  # 0-23
    hour_end: Optional[int] = None  # 0-23
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


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _safe_payload(point: Any) -> dict[str, Any]:
    payload = getattr(point, "payload", None)
    return payload if isinstance(payload, dict) else {}


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
        return list(points) if points is not None else [], next_offset

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


def _parse_search_response(search_response: Any) -> list[Any]:
    """
    Normalize SDK search response variants:
    - plain list of hits
    - tuple where first element is hits
    - object with .points / .results / .hits
    """
    if search_response is None:
        return []

    if isinstance(search_response, list):
        return search_response

    if isinstance(search_response, tuple) and search_response:
        first = search_response[0]
        if isinstance(first, list):
            return first
        try:
            return list(first) if first is not None else []
        except Exception:
            return []

    for attr in ("points", "results", "hits"):
        value = getattr(search_response, attr, None)
        if isinstance(value, list):
            return value
        if value is not None:
            try:
                return list(value)
            except Exception:
                pass

    try:
        return list(search_response)
    except Exception:
        return []


def build_filter(filters: Optional[SearchFilters]):
    """Build VectorAI DB Filter DSL from SearchFilters."""
    if not filters:
        return None

    conditions = []

    if filters.camera_id:
        conditions.append(Field("camera_id").eq(filters.camera_id))

    if filters.date:
        conditions.append(Field("date").eq(filters.date))

    if filters.hour_start is not None and filters.hour_end is not None:
        # Beta-safe: explicit gte/lte
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


def motion_aware_fusion(
    semantic_results: Iterable[Any],
    motion_boost_weight: float = 0.15,
) -> list[SearchResult]:
    """
    Lightweight motion-aware fusion:
    final_score = clip_score * (1 - motion_weight) + motion_score * motion_weight
    """
    fused: list[SearchResult] = []
    for hit in semantic_results:
        payload = _safe_payload(hit)
        clip_score = _to_float(getattr(hit, "score", 0.0), 0.0)
        motion_score = _to_float(payload.get("motion_score", 0.0), 0.0)

        fused_score = (clip_score * (1.0 - motion_boost_weight)) + (
            motion_score * motion_boost_weight
        )

        fused.append(
            SearchResult(
                frame_id=str(getattr(hit, "id", "")),
                score=round(fused_score, 4),
                camera_id=str(payload.get("camera_id", "unknown")),
                video_file=str(payload.get("video_file", "")),
                timestamp_sec=_to_float(payload.get("timestamp_sec", 0.0), 0.0),
                absolute_time=str(payload.get("absolute_time", "")),
                motion_score=motion_score,
                thumbnail_path=str(payload.get("thumbnail_path", "")),
                hour=_to_int(payload.get("hour", 0), 0),
                date=str(payload.get("date", "")),
            )
        )

    fused.sort(key=lambda x: x.score, reverse=True)
    return fused


def _make_event(frames: list[SearchResult]) -> dict[str, Any]:
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


def cluster_into_events(
    results: list[SearchResult], gap_sec: float = 10.0
) -> list[dict[str, Any]]:
    """
    Group consecutive frames within gap_sec into events.
    Grouping key is (camera_id, video_file) to avoid cross-video collisions.
    """
    if not results:
        return []

    from collections import defaultdict

    grouped: dict[tuple[str, str], list[SearchResult]] = defaultdict(list)
    for r in results:
        grouped[(r.camera_id, r.video_file)].append(r)

    all_events: list[dict[str, Any]] = []

    for _, group in grouped.items():
        sorted_group = sorted(group, key=lambda x: x.timestamp_sec)
        if not sorted_group:
            continue

        current_event = [sorted_group[0]]

        for result in sorted_group[1:]:
            prev_time = current_event[-1].timestamp_sec
            if result.timestamp_sec - prev_time <= gap_sec:
                current_event.append(result)
            else:
                all_events.append(_make_event(current_event))
                current_event = [result]

        all_events.append(_make_event(current_event))

    all_events.sort(key=lambda e: e["best_score"], reverse=True)
    return all_events


def search(
    query: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
    group_into_events: bool = True,
    client: VectorAIClient | None = None,
) -> dict[str, Any]:
    """
    Main search entry point.

    1. Embed query text with CLIP
    2. Apply Filter DSL
    3. Vector search in VectorAI DB
    4. Apply motion-aware fusion with motion score
    5. Optionally cluster into events
    """
    db_client: VectorAIClient = client if client is not None else get_client()

    logger.info("Searching query=%r filters=%s limit=%s", query, filters, limit)

    query_vector = embed_text(query)
    db_filter = build_filter(filters) if filters else None

    raw_results = db_client.points.search(
        COLLECTION_NAME,
        vector=query_vector,
        limit=max(1, limit) * 2,  # over-fetch so fusion can rerank
        filter=db_filter,
        with_payload=True,
    )
    raw_results = _parse_search_response(raw_results)

    fused = motion_aware_fusion(raw_results)[: max(1, limit)]

    if not fused:
        return {"query": query, "total_results": 0, "events": [], "frames": []}

    if group_into_events:
        events = cluster_into_events(fused)
        return {
            "query": query,
            "total_results": len(fused),
            "total_events": len(events),
            "events": events,
            "frames": [vars(f) for f in fused],
        }

    return {
        "query": query,
        "total_results": len(fused),
        "events": [],
        "frames": [vars(f) for f in fused],
    }


def list_cameras(client: VectorAIClient | None = None) -> list[str]:
    """Return all unique camera IDs in the collection."""
    db_client: VectorAIClient = client if client is not None else get_client()

    camera_ids: set[str] = set()
    offset = None

    while True:
        scroll_response = db_client.points.scroll(
            COLLECTION_NAME,
            limit=100,
            offset=offset,
            with_payload=True,
        )
        points, next_offset = _parse_scroll_response(scroll_response)

        if not points:
            break

        for point in points:
            payload = _safe_payload(point)
            cam = payload.get("camera_id", "unknown")
            camera_ids.add(str(cam))

        if next_offset is None:
            break

        offset = next_offset

    return sorted(camera_ids)
