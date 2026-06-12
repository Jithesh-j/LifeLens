"""
LifeLens — Activity Service

Business logic for activity CRUD, AI categorization, and semantic search.
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.schemas.activity import ActivityCreate, ActivityListResponse, ActivityResponse, ActivityUpdate
from app.services.ai_service import categorize_activity
from app.services.embedding_service import generate_embedding, search_similar_activities

logger = logging.getLogger(__name__)


async def create_activity(
    db: AsyncSession,
    user_id: UUID,
    payload: ActivityCreate,
) -> ActivityResponse:
    """
    Create a new activity log entry.
    Automatically categorizes with AI and generates an embedding.
    """
    # AI categorization (runs concurrently-ish — fast with gpt-4o-mini)
    analysis = await categorize_activity(payload.content)

    # Generate embedding for semantic search
    embedding = await generate_embedding(payload.content)

    activity = Activity(
        user_id=user_id,
        content=payload.content,
        category=analysis.category,
        mood=analysis.mood,
        tags=",".join(analysis.tags) if analysis.tags else None,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
        embedding=embedding,
    )

    db.add(activity)
    await db.flush()

    return ActivityResponse.model_validate(activity)


async def list_activities(
    db: AsyncSession,
    user_id: UUID,
    page: int = 1,
    page_size: int = 20,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> ActivityListResponse:
    """
    List activities for a user with pagination and optional date filtering.
    """
    query = select(Activity).where(
        Activity.user_id == user_id,
        Activity.is_deleted == False,  # noqa: E712
    )

    if start_date:
        query = query.where(Activity.logged_at >= start_date)
    if end_date:
        query = query.where(Activity.logged_at <= end_date)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = (
        query.order_by(Activity.logged_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    activities = result.scalars().all()

    return ActivityListResponse(
        activities=[ActivityResponse.model_validate(a) for a in activities],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_activity(
    db: AsyncSession,
    user_id: UUID,
    activity_id: UUID,
) -> ActivityResponse | None:
    """Get a single activity by ID (must belong to the user)."""
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == user_id,
            Activity.is_deleted == False,  # noqa: E712
        )
    )
    activity = result.scalar_one_or_none()
    if activity is None:
        return None
    return ActivityResponse.model_validate(activity)


async def delete_activity(
    db: AsyncSession,
    user_id: UUID,
    activity_id: UUID,
) -> bool:
    """Soft-delete an activity (set is_deleted = True)."""
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == user_id,
            Activity.is_deleted == False,  # noqa: E712
        )
    )
    activity = result.scalar_one_or_none()
    if activity is None:
        return False

    activity.is_deleted = True
    await db.flush()
    return True


async def search_activities(
    db: AsyncSession,
    user_id: UUID,
    query: str,
    limit: int = 10,
) -> list[ActivityResponse]:
    """Semantic search across user's activities using pgvector."""
    activities = await search_similar_activities(db, user_id, query, limit)
    return [ActivityResponse.model_validate(a) for a in activities]


async def update_activity(
    db: AsyncSession,
    user_id: UUID,
    activity_id: UUID,
    payload: ActivityUpdate,
) -> ActivityResponse | None:
    """
    Update an existing activity log entry.
    If content is updated, regenerates embedding for semantic search.
    """
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == user_id,
            Activity.is_deleted == False,  # noqa: E712
        )
    )
    activity = result.scalar_one_or_none()
    if activity is None:
        return None

    if payload.content is not None:
        activity.content = payload.content
        activity.embedding = await generate_embedding(payload.content)
        
        # If user did not manually override metadata, run AI categorization
        if payload.category is None and payload.mood is None and payload.tags is None:
            analysis = await categorize_activity(payload.content)
            activity.category = analysis.category
            activity.mood = analysis.mood
            activity.tags = ",".join(analysis.tags) if analysis.tags else None
    
    if payload.category is not None:
        activity.category = payload.category
    
    if payload.mood is not None:
        activity.mood = payload.mood
        
    if payload.tags is not None:
        activity.tags = payload.tags
        
    if payload.logged_at is not None:
        activity.logged_at = payload.logged_at

    await db.flush()
    return ActivityResponse.model_validate(activity)
