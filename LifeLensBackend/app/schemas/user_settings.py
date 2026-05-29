"""
LifeLens — User Settings Schemas

Pydantic models for user settings configurations.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel


class UserSettingsBase(BaseModel):
    """Base user settings schema."""

    location_enabled: bool = False
    smart_activity_detection: bool = False
    smart_notifications: bool = False
    notification_frequency: str = "instant"


class UserSettingsUpdate(BaseModel):
    """Payload to update user settings."""

    location_enabled: bool | None = None
    smart_activity_detection: bool | None = None
    smart_notifications: bool | None = None
    notification_frequency: str | None = None


class UserSettingsResponse(UserSettingsBase):
    """Response returned for user settings."""

    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
