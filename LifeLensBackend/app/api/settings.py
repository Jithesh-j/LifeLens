"""
LifeLens — Settings API Routes

Endpoints for fetching and updating user-specific settings.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user_settings import UserSettingsResponse, UserSettingsUpdate
from app.services.settings_service import (
    get_or_create_user_settings,
    update_user_settings,
)

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get(
    "",
    response_model=UserSettingsResponse,
    summary="Get user-specific settings",
)
async def fetch_user_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """
    Retrieve settings for the currently authenticated user.
    If no settings record exists, a default one will be created.
    """
    settings = await get_or_create_user_settings(db, current_user.id)
    return UserSettingsResponse.model_validate(settings)


@router.put(
    "",
    response_model=UserSettingsResponse,
    summary="Update user-specific settings",
)
async def modify_user_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """
    Update settings for the currently authenticated user.
    """
    settings = await update_user_settings(db, current_user.id, payload)
    return UserSettingsResponse.model_validate(settings)
