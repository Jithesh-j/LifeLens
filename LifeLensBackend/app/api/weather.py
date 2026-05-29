"""
LifeLens — Weather API Routes

End-points to query user-isolated, location-scoped weather.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.weather import WeatherResponse
from app.services.weather_service import get_user_weather

router = APIRouter(prefix="/api/weather", tags=["Weather"])

@router.get(
    "",
    response_model=WeatherResponse,
    summary="Get user-specific isolated weather",
)
async def fetch_user_weather(
    latitude: Optional[float] = Query(None, description="Current GPS latitude"),
    longitude: Optional[float] = Query(None, description="Current GPS longitude"),
    timestamp: str = Query(..., description="Timestamp of the weather request"),
    current_user: User = Depends(get_current_user),
) -> WeatherResponse:
    """
    Fetch weather information tied strictly to latitude, longitude, and timestamp.
    Fully isolated per authenticated user_id. Returns location_unavailable if coordinates are missing.
    """
    try:
        weather = await get_user_weather(
            user_id=current_user.id,
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp,
        )
        return WeatherResponse(**weather)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal weather service error: {str(e)}")
