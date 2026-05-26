"""
LifeLens — Embedding Service

Generates text embeddings via LiteLLM and performs pgvector similarity search.
"""

import logging
from uuid import UUID

import litellm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.activity import Activity

logger = logging.getLogger(__name__)


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a vector embedding for the given text using LiteLLM.
    Returns a list of floats with length = EMBEDDING_DIMENSIONS.
    """
    try:
        response = await litellm.aembedding(
            model=settings.EMBEDDING_MODEL,
            input=[text],
        )
        return response.data[0]["embedding"]
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        # Return a zero vector as fallback so the activity still saves
        return [0.0] * settings.EMBEDDING_DIMENSIONS


async def search_similar_activities(
    db: AsyncSession,
    user_id: UUID,
    query: str,
    limit: int = 10,
) -> list[Activity]:
    """
    Semantic search: embed the query and find the most similar
    activities for this user using pgvector cosine distance.
    """
    query_embedding = await generate_embedding(query)

    # pgvector cosine distance operator: <=>
    result = await db.execute(
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.is_deleted == False,  # noqa: E712
            Activity.embedding.isnot(None),
        )
        .order_by(Activity.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )

    return list(result.scalars().all())
