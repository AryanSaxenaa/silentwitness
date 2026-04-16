"""
VectorAI DB client — collection setup and helpers.
"""
import logging
from actian_vectorai import VectorAIClient, AsyncVectorAIClient
from actian_vectorai.models import (
    VectorParams,
    Distance,
    HnswConfigDiff,
    PointStruct,
)
from config import VECTORAI_HOST, VECTORAI_PORT, COLLECTION_NAME, CLIP_DIM

logger = logging.getLogger(__name__)


def get_client() -> VectorAIClient:
    return VectorAIClient(host=VECTORAI_HOST, port=VECTORAI_PORT)


def get_async_client() -> AsyncVectorAIClient:
    return AsyncVectorAIClient(host=VECTORAI_HOST, port=VECTORAI_PORT)


def ensure_collection(client: VectorAIClient) -> None:
    """Create the frames collection if it doesn't exist."""
    if client.collections.exists(COLLECTION_NAME):
        logger.info(f"Collection '{COLLECTION_NAME}' already exists.")
        return

    client.collections.create(
        COLLECTION_NAME,
        vectors_config=VectorParams(
            size=CLIP_DIM,
            distance=Distance.Cosine,
            hnsw_config=HnswConfigDiff(m=16, ef_construct=200),
        ),
    )
    logger.info(f"Collection '{COLLECTION_NAME}' created.")


def collection_stats(client: VectorAIClient) -> dict:
    info = client.collections.get_info(COLLECTION_NAME)
    count = client.points.count(COLLECTION_NAME)
    return {
        "collection": COLLECTION_NAME,
        "total_frames": count,
        "status": str(info.status) if hasattr(info, "status") else "ok",
    }
