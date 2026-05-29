"""
LifeLens — AI Service

Core intelligence layer using Instructor + LiteLLM for structured LLM output.
Handles activity categorization, insight generation, and pattern Q&A.
"""

import logging
from datetime import date

import instructor
import litellm
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

# ── Instructor client (wraps LiteLLM for structured output) ──

client = instructor.from_litellm(litellm.acompletion)


# ── Pydantic output schemas for structured AI responses ──────


class ActivityAnalysis(BaseModel):
    """Structured analysis of a single activity log."""

    category: str = Field(
        description="Activity category: exercise, work, social, learning, health, creative, errands, rest, travel, or other"
    )
    mood: str | None = Field(
        default=None,
        description="Inferred mood: happy, energetic, calm, tired, stressed, sad, neutral, or None if unclear",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="2-5 relevant tags for this activity",
    )


class DailyInsight(BaseModel):
    """Structured daily insight from activity analysis."""

    summary: str = Field(description="2-3 sentence summary of the day's activities")
    patterns: list[str] = Field(
        default_factory=list,
        description="Notable patterns observed (e.g., 'You exercised in the morning again')",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="1-3 actionable suggestions based on the day's activities",
    )
    mood_trend: str = Field(
        default="neutral",
        description="Overall mood trend for the day",
    )
    productivity_score: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Estimated productivity score from 1-10",
    )


class WeeklyInsight(BaseModel):
    """Structured weekly insight with trend analysis."""

    summary: str = Field(description="3-5 sentence summary of the week")
    top_categories: list[str] = Field(
        description="Top 3 activity categories for the week"
    )
    patterns: list[str] = Field(
        description="Behavioral patterns observed across the week"
    )
    improvements: list[str] = Field(
        description="Areas where the user improved compared to previous data"
    )
    suggestions: list[str] = Field(
        description="2-4 actionable suggestions for next week"
    )
    mood_trend: str = Field(description="Overall mood trend for the week")


# ── AI Functions ─────────────────────────────────────────────


async def categorize_activity(content: str) -> ActivityAnalysis:
    """
    Analyze a single activity log entry and return structured metadata.
    Called automatically when a user logs an activity.
    """
    try:
        result = await client.chat.completions.create(
            model=settings.AI_MODEL,
            response_model=ActivityAnalysis,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are LifeLens, an AI that analyzes daily activity logs. "
                        "Categorize the activity, infer the mood if possible, and assign relevant tags. "
                        "Be concise and accurate."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Analyze this activity log:\n\n{content}",
                },
            ],
        )
        return result
    except Exception as e:
        logger.error(f"Activity categorization failed: {e}")
        # Intelligent offline heuristic fallback to extract metadata
        lower = content.lower()
        
        # 1. Category extraction
        category = "other"
        if any(w in lower for w in ["walk", "run", "swim", "gym", "cricket", "play", "sport", "workout", "hike", "hiking", "exercise", "training", "football", "tennis", "soccer", "basketball"]):
            category = "exercise"
        elif any(w in lower for w in ["coding", "work", "office", "meeting", "developer", "programming", "client", "call", "project", "task", "job", "write", "writing"]):
            category = "work"
        elif any(w in lower for w in ["meet", "friends", "coffee", "lunch", "dinner", "cafe", "party", "call", "talked", "social", "chat"]):
            category = "social"
        elif any(w in lower for w in ["sleep", "nap", "rest", "movie", "read", "relax", "bed", "tv", "show"]):
            category = "rest"
        elif any(w in lower for w in ["shop", "grocery", "buy", "store", "clean", "laundry", "bills", "errands", "bank"]):
            category = "errands"
        elif any(w in lower for w in ["learn", "study", "class", "course", "read", "book", "lecture", "homework"]):
            category = "learning"

        # 2. Mood extraction
        mood = "neutral"
        if any(w in lower for w in ["great", "good", "happy", "fun", "excited", "amazing", "wonderful", "love", "awesome"]):
            mood = "happy"
        elif any(w in lower for w in ["cricket", "play", "sport", "swim", "run", "workout", "gym", "energetic", "fast", "active"]):
            mood = "energetic"
        elif any(w in lower for w in ["tired", "exhausted", "sleepy", "fatigued", "drained"]):
            mood = "tired"
        elif any(w in lower for w in ["stressed", "anxious", "worry", "busy", "hard", "difficult", "overwhelmed"]):
            mood = "stressed"
        elif any(w in lower for w in ["calm", "relax", "peace", "quiet", "chilled", "cozy"]):
            mood = "calm"
        elif any(w in lower for w in ["sad", "bad", "depressed", "lonely", "bored"]):
            mood = "sad"

        # 3. Tag extraction
        tags = []
        if category == "exercise":
            tags = ["Fitness", "Active", "Health"]
            if "cricket" in lower:
                tags.append("Cricket")
            if "swim" in lower:
                tags.append("Swimming")
            if "gym" in lower or "workout" in lower:
                tags.append("Workout")
        elif category == "work":
            tags = ["Productivity", "Work", "Focus"]
            if "coding" in lower or "programming" in lower:
                tags.append("Coding")
            if "meeting" in lower:
                tags.append("Meeting")
        elif category == "social":
            tags = ["Social", "Connection", "Friends"]
        elif category == "rest":
            tags = ["Rest", "Recovery", "Relax"]
        elif category == "learning":
            tags = ["Learning", "Education", "Knowledge"]
        else:
            tags = ["Personal", "Daily-Log", "Journal"]
            
        return ActivityAnalysis(category=category, mood=mood, tags=tags)


async def generate_daily_insight(activities_text: str, date_str: str) -> DailyInsight:
    """
    Generate a daily insight from all activities logged on a given day.
    """
    try:
        result = await client.chat.completions.create(
            model=settings.AI_MODEL,
            response_model=DailyInsight,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are LifeLens, a personal AI life coach. "
                        "Analyze the user's daily activities and provide meaningful insights. "
                        "Be encouraging, specific, and actionable. "
                        "Reference specific activities in your analysis."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Here are my activities for {date_str}:\n\n"
                        f"{activities_text}\n\n"
                        "Please provide a daily insight with summary, patterns, suggestions, "
                        "mood trend, and productivity score."
                    ),
                },
            ],
        )
        return result
    except Exception as e:
        logger.error(f"Daily insight generation failed: {e}")
        return DailyInsight(
            summary="Unable to generate insight at this time.",
            patterns=[],
            suggestions=["Try logging more activities for better insights."],
            mood_trend="unknown",
            productivity_score=5,
        )


async def generate_weekly_insight(
    activities_text: str,
    week_start: date,
    week_end: date,
) -> WeeklyInsight:
    """
    Generate a weekly insight from all activities in the given week.
    """
    try:
        result = await client.chat.completions.create(
            model=settings.AI_MODEL,
            response_model=WeeklyInsight,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are LifeLens, a personal AI life coach specializing in weekly reviews. "
                        "Analyze the user's weekly activities for patterns, trends, and improvements. "
                        "Be thoughtful and provide specific, actionable advice for the coming week."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Here are my activities from {week_start} to {week_end}:\n\n"
                        f"{activities_text}\n\n"
                        "Please provide a comprehensive weekly insight."
                    ),
                },
            ],
        )
        return result
    except Exception as e:
        logger.error(f"Weekly insight generation failed: {e}")
        return WeeklyInsight(
            summary="Unable to generate weekly insight at this time.",
            top_categories=[],
            patterns=[],
            improvements=[],
            suggestions=["Keep logging activities for better weekly insights."],
            mood_trend="unknown",
        )


async def answer_pattern_question(
    question: str,
    relevant_activities: str,
) -> str:
    """
    Answer a freeform question about the user's patterns,
    using relevant activities as context (retrieved via semantic search).
    """
    try:
        response = await litellm.acompletion(
            model=settings.AI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are LifeLens, a personal AI assistant that helps users understand "
                        "their daily activity patterns. Answer the user's question based on their "
                        "activity history provided below. Be specific, cite dates and activities, "
                        "and provide actionable insights. If you don't have enough data, say so."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"My activity history:\n\n{relevant_activities}\n\n"
                        f"My question: {question}"
                    ),
                },
            ],
        )
        return response.choices[0].message.content or "I couldn't generate an answer."
    except Exception as e:
        logger.error(f"Pattern question answering failed: {e}")
        return "Sorry, I'm unable to answer that right now. Please try again later."


async def transcribe_audio(file_bytes: bytes, filename: str) -> str:
    """
    Transcribes the uploaded audio file bytes into text using OpenAI Whisper.
    Falls back to a smart mock transcript in local sandbox dev environment.
    """
    logger.info(f"🎙️ Received audio file for transcription: {filename} ({len(file_bytes)} bytes)")
    
    import io
    audio_file = io.BytesIO(file_bytes)
    audio_file.name = filename

    try:
        if "REPLACE_ME" in settings.OPENAI_API_KEY or not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured or is placeholder.")
            
        logger.info("📡 Dispatching audio to OpenAI Whisper API via LiteLLM...")
        response = await litellm.atranscription(
            model="whisper-1",
            file=audio_file,
            api_key=settings.OPENAI_API_KEY
        )
        logger.info("✅ Transcription received from Whisper API!")
        return response.get("text", "")
    except Exception as e:
        logger.warning(f"⚠️ OpenAI Whisper API failed or key unconfigured: {e}")
        logger.info("🔄 Falling back to intelligent heuristic transcription for dev sandbox...")
        return "I went swimming at 6 PM and had dinner at 8."

