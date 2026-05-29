"""
LifeLens Backend — FastAPI Application Entry Point

Run with: uvicorn app.main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.activities import router as activities_router
from app.api.auth import router as auth_router
from app.api.insights import router as insights_router
from app.api.settings import router as settings_router
from app.config import settings
from app.database import engine

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan — runs on startup and shutdown.
    Manages the database connection pool.
    """
    logger.info("🚀 LifeLens Backend starting up...")
    logger.info(f"   Database: {settings.DATABASE_URL.split('@')[-1]}")
    logger.info(f"   AI Model: {settings.AI_MODEL}")

    yield  # App runs here

    logger.info("🛑 LifeLens Backend shutting down...")
    await engine.dispose()


# ── Create FastAPI App ────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "LifeLens — Your AI-powered daily activity journal. "
        "Log what you do, and get intelligent insights about your behavioral patterns."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include Routers ──────────────────────────────────────────

app.include_router(auth_router)
app.include_router(activities_router)
app.include_router(insights_router)
app.include_router(settings_router)


# ── Health Check ─────────────────────────────────────────────


@app.get("/health", tags=["Health"])
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "0.1.0",
    }
