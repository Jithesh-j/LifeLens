"""
LifeLens — Weather API Schemas
"""

from pydantic import BaseModel
from typing import Optional

class WeatherResponse(BaseModel):
    status: str  # "ok" or "location_unavailable"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    temperature_c: Optional[float] = None
    temperature_f: Optional[float] = None
    weathercode: Optional[int] = None
    wind_speed: Optional[float] = None
    humidity: Optional[float] = None
    timestamp: Optional[str] = None
    user_id: Optional[str] = None
    fetched_at: Optional[str] = None

    class Config:
        from_attributes = True
