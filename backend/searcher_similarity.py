"""
Frame similarity search — "find similar moments" from an existing indexed frame.
Uses the stored vector directly: no re-embedding, no text query needed.
Plugs into the same DBSF fusion + event clustering pipeline.
"""
import logging
from typing import Optional

from actian_vectorai import VectorAIClient
from actian_vectorai.models import Field, FilterBuilder

from config import COLLECTION_NAME
from db import get_client
from searcher import dbsf_fusion, cluster_into_events, SearchFilters, build_filter

logger = logging.getLogger(__name__)


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
    # Vector may be returned as dict (named) or list
    vec = point.vector
    if isinstance(vec, dict):
        vec = list(vec.values())[0]
    return vec


def search_similar(
    frame_id: str,
    filters: Optional[SearchFilters] = None,
    limit: int = 20,
    exclude_same_video: bool = False,
    client: Optional[VectorAIClient] = None,
) -> dict:
    """
    Find frames visually similar to a given frame_id.

    1. Fetch the stored CLIP vector for the source frame
    2. Run vector similarity search (same pipeline as text search)
    3. Filter out the source frame itself from results
    4. Apply DBSF fusion + event clustering

    This is the "find every time this person appeared" feature.
    """
    if client is None:
        client = get_client()

    logger.info(f"Similarity search from frame: {frame_id}")

    # Step 1: get source vector
    vector = get_frame_vector(frame_id, client)
    if vector is None:
        return {"error": f"Frame {frame_id} not found in index", "events": [], "frames": []}

    # Step 2: get source frame metadata (for context in response)
    source_points = client.points.get(
        COLLECTION_NAME,
        ids=[frame_id],
        with_payload=True,
        with_vectors=False,
    )
    source_payload = source_points[0].payload if source_points else {}

    # Build filter
    db_filter = build_filter(filters) if filters else None

    source_video = source_payload.get("video_file") if exclude_same_video else None

    # Over-fetch to allow post-search filtering (self + same-video exclusions).
    # .ne() is not reliably in the beta SDK, so we always filter in Python.
    fetch_limit = limit * 3 if exclude_same_video else limit + 1
    raw_results = client.points.search(
        COLLECTION_NAME,
        vector=vector,
        limit=fetch_limit,
        query_filter=db_filter,
        with_payload=True,
    )

    # Exclude self and (optionally) same video
    raw_results = [
        r for r in raw_results
        if str(r.id) != frame_id
        and (source_video is None or r.payload.get("video_file") != source_video)
    ]

    raw_results = raw_results[:limit]

    if not raw_results:
        return {
            "source_frame_id": frame_id,
            "source_payload": source_payload,
            "total_results": 0,
            "events": [],
            "frames": [],
        }

    # DBSF fusion + clustering
    fused = dbsf_fusion(raw_results)
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
