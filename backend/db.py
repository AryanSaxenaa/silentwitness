"""
VectorAI DB client — collection setup and helpers.

Design contract
---------------
* get_client() lazily creates and reuses a shared VectorAIClient.
* The lifespan in main.py must wrap first-time get_client() calls with
  asyncio.to_thread() so the async startup coroutine is never blocked.
* Reusing the gRPC client avoids reconnect storms under UI polling.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Optional

logger = logging.getLogger(__name__)
_client_lock = threading.Lock()
_shared_client: Optional[VectorAIClient] = None

# ---------------------------------------------------------------------------
# SDK imports — handle symbol location differences across beta SDK builds
# ---------------------------------------------------------------------------

from actian_vectorai import VectorAIClient  # noqa: E402

try:
    from actian_vectorai import Distance, HnswConfigDiff, VectorParams  # type: ignore
except ImportError:
    from actian_vectorai.models import (  # type: ignore
        Distance,
        HnswConfigDiff,
        VectorParams,
    )

try:
    from actian_vectorai import PointStruct  # type: ignore
except ImportError:
    from actian_vectorai.models import PointStruct  # type: ignore  # noqa: F401

try:
    from actian_vectorai import Field, FilterBuilder  # type: ignore  # noqa: F401
except ImportError:
    from actian_vectorai.models import (  # type: ignore  # noqa: F401
        Field,
        FilterBuilder,
    )

from config import CLIP_DIM, COLLECTION_NAME, VECTORAI_HOST, VECTORAI_PORT

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _endpoint() -> str:
    """gRPC endpoint string used by VectorAIClient("host:port")."""
    return f"{VECTORAI_HOST}:{VECTORAI_PORT}"


# ---------------------------------------------------------------------------
# Public client factory
# ---------------------------------------------------------------------------


def get_client() -> VectorAIClient:
    """
    Create and connect a sync VectorAI client.

    Safe to call from sync def endpoints (FastAPI thread pool).
    Do NOT call from async def handlers or lifespan directly —
    wrap with asyncio.to_thread() in those contexts.
    """
    global _shared_client

    if _shared_client is not None:
        return _shared_client

    with _client_lock:
        if _shared_client is not None:
            return _shared_client

        client = VectorAIClient(_endpoint())
        try:
            client.connect()
            logger.info("Connected to %s", _endpoint())
        except Exception as exc:
            # Log but don't raise — some SDK builds auto-connect on first RPC call.
            logger.warning("VectorAI connect() raised (may be OK): %s", exc)
        _shared_client = client
        return _shared_client


def close_client() -> None:
    """Close the shared client if the SDK exposes a close/disconnect hook."""
    global _shared_client

    with _client_lock:
        client = _shared_client
        _shared_client = None

    if client is None:
        return

    for method_name in ("close", "disconnect"):
        method = getattr(client, method_name, None)
        if callable(method):
            try:
                method()
            except Exception as exc:
                logger.warning("VectorAI %s() raised during shutdown: %s", method_name, exc)
            break


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------


def ensure_collection(client: VectorAIClient) -> None:
    """Create the frames collection if it does not already exist."""
    try:
        if client.collections.exists(COLLECTION_NAME):
            logger.info("Collection '%s' already exists.", COLLECTION_NAME)
            return
    except Exception as exc:
        logger.warning("collections.exists() failed: %s — will attempt create.", exc)

    try:
        client.collections.create(
            COLLECTION_NAME,
            vectors_config=VectorParams(
                size=CLIP_DIM,
                distance=Distance.Cosine,
            ),
            hnsw_config=HnswConfigDiff(m=16, ef_construct=200),
        )
        logger.info("Collection '%s' created.", COLLECTION_NAME)
    except Exception as exc:
        logger.warning("collections.create() failed (may already exist): %s", exc)


def collection_stats(client: VectorAIClient) -> dict[str, Any]:
    """Return basic collection metadata and total point count."""
    try:
        info = client.collections.get_info(COLLECTION_NAME)
        status = str(info.status) if hasattr(info, "status") else "ok"
    except Exception:
        status = "unknown"

    try:
        raw_count = client.points.count(COLLECTION_NAME)
        if isinstance(raw_count, int):
            count = raw_count
        elif hasattr(raw_count, "count"):
            count = int(getattr(raw_count, "count", 0) or 0)
        else:
            count = int(raw_count) if raw_count is not None else 0
    except Exception:
        count = 0

    return {
        "collection": COLLECTION_NAME,
        "total_frames": count,
        "status": status,
    }
