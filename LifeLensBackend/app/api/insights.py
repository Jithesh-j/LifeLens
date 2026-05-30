"""
LifeLens — Insights API Routes

Endpoints for AI-generated daily/weekly insights and pattern Q&A.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.activity import Activity
from app.models.insight import Insight
from app.models.user import User
from app.schemas.insight import (
    AskRequest,
    AskResponse,
    InsightListResponse,
    InsightResponse,
    SuggestionsRequest,
    SuggestionsResponse,
    SuggestionItem,
)
from app.services.ai_service import (
    answer_pattern_question,
    generate_daily_insight,
    generate_weekly_insight,
    generate_user_suggestions,
)
from app.services.embedding_service import search_similar_activities

router = APIRouter(prefix="/api/insights", tags=["Insights"])


def _format_activities(activities: list[Activity]) -> str:
    """Format activities into a text block for the LLM."""
    lines = []
    for a in activities:
        time_str = a.logged_at.strftime("%I:%M %p") if a.logged_at else "Unknown time"
        date_str = a.logged_at.strftime("%Y-%m-%d") if a.logged_at else ""
        mood_str = f" (mood: {a.mood})" if a.mood else ""
        cat_str = f" [{a.category}]" if a.category else ""
        lines.append(f"- {date_str} {time_str}{cat_str}{mood_str}: {a.content}")
    return "\n".join(lines) if lines else "No activities found."


@router.get(
    "/daily",
    response_model=InsightResponse,
    summary="Get today's AI insight",
)
async def get_daily_insight(
    target_date: date | None = Query(default=None, description="Date to get insight for (defaults to today)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """
    Generate (or retrieve cached) daily insight for the given date.
    Analyzes all activities logged on that day and provides a summary,
    patterns, suggestions, and mood trend.
    """
    today = target_date or date.today()

    # Check if insight already exists
    result = await db.execute(
        select(Insight).where(
            Insight.user_id == current_user.id,
            Insight.insight_type == "daily",
            Insight.period_start == today,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return InsightResponse.model_validate(existing)

    # Fetch activities for the day
    day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    day_end = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)

    result = await db.execute(
        select(Activity).where(
            Activity.user_id == current_user.id,
            Activity.is_deleted == False,  # noqa: E712
            Activity.logged_at >= day_start,
            Activity.logged_at <= day_end,
        ).order_by(Activity.logged_at)
    )
    activities = list(result.scalars().all())

    activities_text = _format_activities(activities)

    # Generate insight with AI
    ai_insight = await generate_daily_insight(activities_text, str(today))

    # Store it
    insight = Insight(
        user_id=current_user.id,
        insight_type="daily",
        content=ai_insight.summary,
        period_start=today,
        period_end=today,
        metadata_json={
            "patterns": ai_insight.patterns,
            "suggestions": ai_insight.suggestions,
            "mood_trend": ai_insight.mood_trend,
            "productivity_score": ai_insight.productivity_score,
            "activity_count": len(activities),
        },
    )
    db.add(insight)
    await db.flush()

    return InsightResponse.model_validate(insight)


@router.get(
    "/weekly",
    response_model=InsightResponse,
    summary="Get this week's AI insight",
)
async def get_weekly_insight(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InsightResponse:
    """
    Generate (or retrieve cached) weekly insight.
    Analyzes all activities from Monday through today.
    """
    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday

    # Check if insight already exists
    result = await db.execute(
        select(Insight).where(
            Insight.user_id == current_user.id,
            Insight.insight_type == "weekly",
            Insight.period_start == week_start,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return InsightResponse.model_validate(existing)

    # Fetch activities for the week
    start_dt = datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(today, datetime.max.time(), tzinfo=timezone.utc)

    result = await db.execute(
        select(Activity).where(
            Activity.user_id == current_user.id,
            Activity.is_deleted == False,  # noqa: E712
            Activity.logged_at >= start_dt,
            Activity.logged_at <= end_dt,
        ).order_by(Activity.logged_at)
    )
    activities = list(result.scalars().all())

    activities_text = _format_activities(activities)

    # Generate insight with AI
    ai_insight = await generate_weekly_insight(activities_text, week_start, today)

    # Store it
    insight = Insight(
        user_id=current_user.id,
        insight_type="weekly",
        content=ai_insight.summary,
        period_start=week_start,
        period_end=today,
        metadata_json={
            "top_categories": ai_insight.top_categories,
            "patterns": ai_insight.patterns,
            "improvements": ai_insight.improvements,
            "suggestions": ai_insight.suggestions,
            "mood_trend": ai_insight.mood_trend,
            "activity_count": len(activities),
        },
    )
    db.add(insight)
    await db.flush()

    return InsightResponse.model_validate(insight)


@router.post(
    "/suggestions",
    response_model=SuggestionsResponse,
    summary="Get or generate AI-personalized daily suggestions",
)
async def get_or_generate_suggestions(
    payload: SuggestionsRequest,
    refresh: bool = Query(default=False, description="Force re-generation of suggestions"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuggestionsResponse:
    """
    Get cached daily personalized recommendations or trigger a new AI-driven analysis.
    Combines historical DB logs with client-side enriched locations, weather, and schedule.
    """
    import uuid
    today = date.today()

    # 1. Cache hit check (if not forcing refresh)
    if not refresh:
        result = await db.execute(
            select(Insight).where(
                Insight.user_id == current_user.id,
                Insight.insight_type == "suggestions",
                Insight.period_start == today,
            )
        )
        existing = result.scalar_one_or_none()
        if existing and existing.metadata_json and "suggestions" in existing.metadata_json:
            return SuggestionsResponse(
                suggestions=[SuggestionItem.model_validate(s) for s in existing.metadata_json["suggestions"]]
            )

    # 2. Cache miss or refresh: Gather complete history context

    # Fetch historical user activities (past 14 days)
    two_weeks_ago = datetime.combine(today - timedelta(days=14), datetime.min.time(), tzinfo=timezone.utc)
    result = await db.execute(
        select(Activity).where(
            Activity.user_id == current_user.id,
            Activity.is_deleted == False,  # noqa: E712
            Activity.logged_at >= two_weeks_ago,
        ).order_by(Activity.logged_at.desc())
    )
    db_activities = list(result.scalars().all())

    # Format client-side enriched items
    client_lines = []
    for item in payload.schedule_items:
        loc_str = f" @ {item.location['name']}" if (item.location and item.location.get('name')) else ""
        weather_str = ""
        if item.weather:
            temp = item.weather.get('temperature_c', '')
            cond = item.weather.get('condition', '')
            weather_str = f" (Weather: {temp}°C, {cond})"
        
        client_lines.append(
            f"- {item.date} {item.timeRange or ''} [{item.category or 'other'}]: {item.title}{loc_str}{weather_str}"
        )
    client_activities_text = "\n".join(client_lines) if client_lines else "No recent client activities."

    # Combine both DB activities and client-enriched activities
    activities_context = (
        "=== CLIENT ENRICHED RECENT TIMELINE ===\n"
        f"{client_activities_text}\n\n"
        "=== HISTORICAL ACTIVITY LOGS ===\n"
        f"{_format_activities(db_activities)}"
    )

    # Fetch past daily & weekly summaries
    result = await db.execute(
        select(Insight).where(
            Insight.user_id == current_user.id,
            Insight.insight_type.in_(["daily", "weekly"]),
        ).order_by(Insight.created_at.desc()).limit(10)
    )
    past_insights = list(result.scalars().all())
    
    historical_insights_text = "\n".join(
        f"- [{i.insight_type} - {i.period_start}]: {i.content}" for i in past_insights
    )

    # 3. Call AI suggestions service
    ai_suggestions = await generate_user_suggestions(
        activities_context,
        historical_insights_text,
    )

    # 4. Store/Cache suggestions in the database
    
    # Clean up any existing suggestions for today (e.g. if we are doing a manual refresh)
    result = await db.execute(
        select(Insight).where(
            Insight.user_id == current_user.id,
            Insight.insight_type == "suggestions",
            Insight.period_start == today,
        )
    )
    existing_today = result.scalar_one_or_none()
    if existing_today:
        await db.delete(existing_today)
        await db.flush()

    # Generate clean response models
    stored_suggestions = []
    for sug in ai_suggestions.suggestions:
        stored_suggestions.append({
            "id": f"s_{uuid.uuid4().hex[:8]}",
            "title": sug.title,
            "recommendation": sug.recommendation,
            "evidence": sug.evidence,
            "confidence": sug.confidence,
            "category": sug.category,
            "icon": sug.icon,
            "suggested_time": sug.suggested_time,
        })

    insight = Insight(
        user_id=current_user.id,
        insight_type="suggestions",
        content="Daily AI Coach Suggestions",
        period_start=today,
        period_end=today,
        metadata_json={
            "suggestions": stored_suggestions,
        },
    )
    db.add(insight)
    await db.flush()

    return SuggestionsResponse(
        suggestions=[SuggestionItem.model_validate(s) for s in stored_suggestions]
    )


@router.get(
    "/history",
    response_model=InsightListResponse,
    summary="List past insights",
)
async def get_insight_history(
    insight_type: str | None = Query(default=None, description="Filter by type: daily, weekly"),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InsightListResponse:
    """Get a list of past AI-generated insights."""
    query = select(Insight).where(Insight.user_id == current_user.id)

    if insight_type:
        query = query.where(Insight.insight_type == insight_type)

    query = query.order_by(Insight.created_at.desc()).limit(limit)
    result = await db.execute(query)
    insights = list(result.scalars().all())

    return InsightListResponse(
        insights=[InsightResponse.model_validate(i) for i in insights],
        total=len(insights),
    )


@router.post(
    "/ask",
    response_model=AskResponse,
    summary="Ask about your patterns",
)
async def ask_patterns(
    payload: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AskResponse:
    """
    Ask a freeform question about your activity patterns.
    Uses semantic search to find relevant activities, then
    feeds them to AI for a personalized answer.

    Example: "When do I exercise most?" or "How has my sleep been?"
    """
    # Find relevant activities via semantic search
    relevant = await search_similar_activities(
        db, current_user.id, payload.question, limit=20
    )

    activities_text = _format_activities(relevant)

    # Get AI answer
    answer = await answer_pattern_question(payload.question, activities_text)

    # Store as an "answer" insight
    insight = Insight(
        user_id=current_user.id,
        insight_type="answer",
        content=answer,
        metadata_json={
            "question": payload.question,
            "activity_ids": [str(a.id) for a in relevant],
        },
    )
    db.add(insight)
    await db.flush()

    return AskResponse(
        question=payload.question,
        answer=answer,
        related_activities=[a.id for a in relevant],
    )
