"""
LifeLens — Settings Service

Business logic for user-specific settings.
"""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_settings import UserSettings
from app.schemas.user_settings import UserSettingsUpdate

logger = logging.getLogger(__name__)


async def get_or_create_user_settings(
    db: AsyncSession,
    user_id: UUID,
) -> UserSettings:
    """
    Fetch user settings for the given user_id.
    If the settings record does not exist, create it with default values.
    """
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if settings is None:
        logger.info(f"⚙️ Creating default settings for user: {user_id}")
        settings = UserSettings(
            user_id=user_id,
            location_enabled=False,
            smart_activity_detection=False,
            smart_notifications=False,
            notification_frequency="instant",
        )
        db.add(settings)
        await db.flush()

    return settings


async def update_user_settings(
    db: AsyncSession,
    user_id: UUID,
    payload: UserSettingsUpdate,
) -> UserSettings:
    """
    Update settings strictly for the authenticated user_id.
    """
    settings = await get_or_create_user_settings(db, user_id)

    # Partial update: only update attributes that are explicitly passed in payload
    if payload.location_enabled is not None:
        settings.location_enabled = payload.location_enabled
    if payload.smart_activity_detection is not None:
        settings.smart_activity_detection = payload.smart_activity_detection
    if payload.smart_notifications is not None:
        settings.smart_notifications = payload.smart_notifications
    if payload.notification_frequency is not None:
        settings.notification_frequency = payload.notification_frequency

    await db.flush()
    return settings
