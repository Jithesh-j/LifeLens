"""
LifeLens — Insight Schemas

Pydantic models for AI-generated insights and pattern queries.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ── Requests ──────────────────────────────────────────────────


class AskRequest(BaseModel):
    """Ask a freeform question about your activity patterns."""

    question: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="E.g., 'When do I exercise most?' or 'How has my mood been this week?'",
    )


# ── Responses ─────────────────────────────────────────────────


class InsightResponse(BaseModel):
    """Single AI-generated insight."""

    id: uuid.UUID
    insight_type: str
    content: str
    period_start: date | None = None
    period_end: date | None = None
    metadata_json: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class InsightListResponse(BaseModel):
    """List of past insights."""

    insights: list[InsightResponse]
    total: int


class AskResponse(BaseModel):
    """Response to a freeform pattern question."""

    question: str
    answer: str
    related_activities: list[uuid.UUID] = Field(
        default_factory=list,
        description="IDs of activities that informed this answer",
    )
