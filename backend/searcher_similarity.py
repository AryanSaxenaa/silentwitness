"""
Frame similarity search — "find similar moments" from an existing indexed frame.
Uses the stored vector directly: no re-embedding, no text query needed.
Plugs into the same DBSF fusion + event clustering pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

try:
    from actian_vectorai import VectorAIClient
except ImportError:
    from actian_vectorai.models import VectorAIClient
from config import COLLECTION_NAME
from db import get_client
from searcher import SearchFilters, build_filter, cluster_into_events, dbsf_fusion

logger = logging.getLogger(__name__)


def _safe_payload(point: Any) -> dict[str, Any]:
    payload = getattr(point, "payload", None)
    return payload if isinstance(payload, dict) else {}


def _parse_search_response(search_response: Any) -> list[Any]:
    """Normalize SDK search response wrappers into a plain hit list."""
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


def _normalize_vector(value: Any) -> list[float] | None:
    """
    Normalize vector payload shapes returned by SDK:
    - list[float]
    - tuple[float, ...]
    - dict[str, list[float]] (named vectors)
    """
    if value is None:
        return None

    if isinstance(value, list):
        try:
            return [float(v) for v in value]
        except Exception:
            return None

    if isinstance(value, tuple):
        try:
            return [float(v) for v in value]
        except Exception:
            return None

    if isinstance(value, dict):
        if not value:
            return None
        first = next(iter(value.values()))
        if isinstance(first, (list, tuple)):
            try:
                return [float(v) for v in first]
            except Exception:
                return None

    return None


def get_frame_vector(frame_id: str, client: VectorAIClient) -> list[float] | None:
    """Fetch the stored CLIP vector for a frame by its ID."""
    results = client.points.get(
        COLLECTION_NAME,
        ids=[frame_id],
        with_vectors=True,
        with_payload=False,
    )
    if not results:
        return None

    point = results[0]
    # Retrieved points expose vectors on `.vectors` in the beta SDK.
    return _normalize_vector(
        getattr(point, "vectors", getattr(point, "vector", None))
    )


def search_similar(
    frame_id: str,
    filters: SearchFilters | None = None,
    limit: int = 20,
    exclude_same_video: bool = False,
    client: VectorAIClient | None = None,
) -> dict[str, Any]:
    """
    Find frames visually similar to a given frame_id.

    1. Fetch the stored CLIP vector for the source frame
    2. Run vector similarity search (same pipeline as text search)
    3. Filter out the source frame itself from results
    4. Apply DBSF fusion + event clustering
    """
    db_client: VectorAIClient = client if client is not None else get_client()

    logger.info("Similarity search from frame: %s", frame_id)

    # Step 1: get source vector
    vector = get_frame_vector(frame_id, db_client)
    if vector is None:
        return {
            "error": f"Frame {frame_id} not found in index",
            "events": [],
            "frames": [],
        }

    # Step 2: get source frame metadata (for context in response)
    source_points = db_client.points.get(
        COLLECTION_NAME,
        ids=[frame_id],
        with_payload=True,
        with_vectors=False,
    )
    source_payload = _safe_payload(source_points[0]) if source_points else {}

    # Step 3: optional filter
    db_filter = build_filter(filters) if filters else None
    source_video = source_payload.get("video_file") if exclude_same_video else None

    # Over-fetch to allow post-search filtering (self + same-video exclusions).
    fetch_limit = (max(1, limit) * 3) if exclude_same_video else (max(1, limit) + 1)
    raw_results = db_client.points.search(
        COLLECTION_NAME,
        vector=vector,
        limit=fetch_limit,
        filter=db_filter,
        with_payload=True,
    )
    raw_results = _parse_search_response(raw_results)

    filtered_results = [
        r
        for r in raw_results
        if str(getattr(r, "id", "")) != frame_id
        and (source_video is None or _safe_payload(r).get("video_file") != source_video)
    ][: max(1, limit)]

    if not filtered_results:
        return {
            "source_frame_id": frame_id,
            "source_payload": source_payload,
            "total_results": 0,
            "events": [],
            "frames": [],
        }

    # Step 4: DBSF fusion + clustering
    fused = dbsf_fusion(filtered_results)
    events = cluster_into_events(fused)

    return {
        "source_frame_id": frame_id,
        "source_camera": source_payload.get("camera_id"),
        "source_time": source_payload.get("absolute_time"),
        "source_thumbnail": source_payload.get("thumbnail_path"),
        "total_results": len(fused),
        "total_events": len(events),
        "events": events,
        "frames": [vars(f) for f in fused],
    }
