"""
LifeLens — Activity Schemas

Pydantic models for activity logging, listing, and semantic search.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Requests ──────────────────────────────────────────────────


class ActivityCreate(BaseModel):
    """Log a new activity."""

    content: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="What you did — text description of the activity",
    )
    logged_at: datetime | None = Field(
        default=None,
        description="When the activity happened. Defaults to now.",
    )


class ActivitySearchQuery(BaseModel):
    """Semantic search across activities."""

    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(default=10, ge=1, le=50)


# ── Responses ─────────────────────────────────────────────────


class ActivityResponse(BaseModel):
    """Single activity detail."""

    id: uuid.UUID
    content: str
    category: str | None = None
    mood: str | None = None
    tags: str | None = None
    logged_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityListResponse(BaseModel):
    """Paginated list of activities."""

    activities: list[ActivityResponse]
    total: int
    page: int
    page_size: int
