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


class SuggestionItem(BaseModel):
    """A single personalized suggestion recommendation."""

    id: str = Field(description="Unique ID for the suggestion")
    title: str = Field(description="Short title summarizing the recommendation")
    recommendation: str = Field(description="Actionable and specific recommendation")
    evidence: str = Field(description="Supporting evidence/findings from user history")
    confidence: int = Field(description="Confidence score as a percentage between 1 and 100", ge=1, le=100)
    category: str = Field(description="Category theme: health, work, social, rest, or other")
    icon: str = Field(description="Icon symbol name for rendering")
    suggested_time: str = Field(description="Suggested time of day to perform this recommendation (e.g. '8:30 AM')")


class SuggestionsResponse(BaseModel):
    """List of generated suggestions."""

    suggestions: list[SuggestionItem]


class SuggestionsRequestItem(BaseModel):
    """Activity representation sent from client scheduleItems for enrichment."""

    title: str
    timeRange: str | None = None
    category: str | None = None
    date: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    location: dict | None = None
    weather: dict | None = None


class SuggestionsRequest(BaseModel):
    """Request payload containing client-side enriched activities."""

    schedule_items: list[SuggestionsRequestItem] = []


