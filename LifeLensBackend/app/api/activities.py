"""
LifeLens — Activities API Routes

Endpoints for logging, listing, searching, and deleting activities.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.activity import (
    ActivityCreate,
    ActivityListResponse,
    ActivityResponse,
    ActivitySearchQuery,
)
from app.services.activity_service import (
    create_activity,
    delete_activity,
    get_activity,
    list_activities,
    search_activities,
)

router = APIRouter(prefix="/api/activities", tags=["Activities"])


@router.post(
    "",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a new activity",
)
async def log_activity(
    payload: ActivityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityResponse:
    """
    Log a new activity. AI will automatically categorize it,
    detect mood, assign tags, and generate an embedding.
    """
    return await create_activity(db, current_user.id, payload)


@router.get(
    "",
    response_model=ActivityListResponse,
    summary="List your activities",
)
async def get_activities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityListResponse:
    """List activities with pagination and optional date range filtering."""
    return await list_activities(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/{activity_id}",
    response_model=ActivityResponse,
    summary="Get a single activity",
)
async def get_single_activity(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityResponse:
    """Get details of a specific activity."""
    result = await get_activity(db, current_user.id, activity_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )
    return result


@router.delete(
    "/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an activity",
)
async def remove_activity(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete an activity."""
    deleted = await delete_activity(db, current_user.id, activity_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )


@router.post(
    "/search",
    response_model=list[ActivityResponse],
    summary="Semantic search across your activities",
)
async def search(
    payload: ActivitySearchQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityResponse]:
    """
    Search activities by meaning using AI embeddings.
    Example: 'morning exercise' will find related entries even
    if they don't contain those exact words.
    """
    return await search_activities(
        db,
        current_user.id,
        payload.query,
        payload.limit,
    )
