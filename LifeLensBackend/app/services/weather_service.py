"""
LifeLens — Weather Service

Orchestrates user-isolated weather queries, time-windowed location-specific caching,
and strictly rejects guessing city fallbacks if GPS is unavailable.
"""

import logging
import httpx
from datetime import datetime, timezone
import uuid
from typing import Dict, Tuple, Any, Optional

logger = logging.getLogger(__name__)

# Thread-safe in-memory cache scoped by: (user_id, lat_rounded, lon_rounded, time_window_index)
# Time window index is in 10-minute intervals (600 seconds)
# Lat/lon rounded to 3 decimal places (~110 meters) to allow slight movement caching.
WEATHER_CACHE: Dict[Tuple[uuid.UUID, float, float, int], Dict[str, Any]] = {}

def get_time_window(timestamp_str: str) -> int:
    """Computes a unique 10-minute time window index from an ISO timestamp."""
    try:
        # Normalize trailing 'Z' to '+00:00'
        normalized = timestamp_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        # Ensure it has a timezone; if not, assume UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp()) // 600
    except Exception as e:
        logger.warning(f"Failed to parse timestamp '{timestamp_str}', falling back to current window: {e}")
        return int(datetime.now(timezone.utc).timestamp()) // 600

async def fetch_weather_from_api(lat: float, lon: float, target_timestamp: str) -> Optional[Dict[str, Any]]:
    """
    Query Open-Meteo with hourly variables & past_days=7 (covering recent/historical events).
    Selects the closest matching hour to target_timestamp.
    """
    logger.info(f"🌐 [Weather] Querying Open-Meteo API for coordinates: ({lat}, {lon}) at timestamp: {target_timestamp}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,weathercode&past_days=7"
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                hourly = data.get("hourly")
                if hourly and "time" in hourly:
                    # Normalize target timestamp
                    normalized = target_timestamp.replace("Z", "+00:00")
                    target_dt = datetime.fromisoformat(normalized)
                    if target_dt.tzinfo is None:
                        target_dt = target_dt.replace(tzinfo=timezone.utc)
                    target_ts = target_dt.timestamp()

                    best_index = 0
                    min_diff = float("inf")

                    for i, time_str in enumerate(hourly["time"]):
                        # Open-Meteo naive local times matching "YYYY-MM-DDTHH:MM"
                        dt = datetime.fromisoformat(time_str)
                        dt = dt.replace(tzinfo=target_dt.tzinfo)
                        diff = abs(target_ts - dt.timestamp())
                        if diff < min_diff:
                            min_diff = diff
                            best_index = i

                    temp_c = hourly["temperature_2m"][best_index]
                    temp_f = round((temp_c * 9) / 5 + 32)
                    humidity = hourly["relativehumidity_2m"][best_index]
                    wind_speed = hourly["windspeed_10m"][best_index]
                    code = hourly["weathercode"][best_index]

                    return {
                        "temperature_c": temp_c,
                        "temperature_f": temp_f,
                        "weathercode": code,
                        "wind_speed": wind_speed,
                        "humidity": humidity,
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }

                # Fallback to current weather if hourly structure is missing
                logger.warning("🌐 [Weather] Hourly forecast missing in Open-Meteo response, trying current weather fallback.")
                current_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
                current_res = await client.get(current_url)
                if current_res.status_code == 200:
                    current_data = current_res.json().get("current_weather")
                    if current_data:
                        temp_c = current_data["temperature"]
                        temp_f = round((temp_c * 9) / 5 + 32)
                        return {
                            "temperature_c": temp_c,
                            "temperature_f": temp_f,
                            "weathercode": current_data["weathercode"],
                            "wind_speed": current_data.get("windspeed", 5.0),
                            "humidity": 50.0,
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                        }
            logger.warning(f"🌐 [Weather] Failed to query Open-Meteo: {res.status_code}")
    except Exception as e:
        logger.error(f"🌐 [Weather] Error querying Open-Meteo: {e}")
    return None

async def get_user_weather(
    user_id: uuid.UUID,
    latitude: Optional[float],
    longitude: Optional[float],
    timestamp: str
) -> Dict[str, Any]:
    """
    Main orchestrator fetching weather based strictly on exact location and timestamp.
    If no coordinates are provided, returns location_unavailable without guessing a city.
    """
    if latitude is None or longitude is None:
        logger.info(f"🌐 [Weather] No coordinates provided for User {user_id}. Returning location_unavailable.")
        return {"status": "location_unavailable"}

    # Rounded coordinates for caching safely
    lat_r = round(latitude, 3)
    lon_r = round(longitude, 3)

    # Get 10-minute time window index
    time_window = get_time_window(timestamp)

    # Check isolated user-scoped cache
    cache_key = (user_id, lat_r, lon_r, time_window)
    if cache_key in WEATHER_CACHE:
        logger.info(f"💾 [Weather Cache] Scoped HIT for User {user_id} at window {time_window}")
        return WEATHER_CACHE[cache_key]

    # Fetch fresh weather from API
    weather_data = await fetch_weather_from_api(latitude, longitude, timestamp)
    if not weather_data:
        return {"status": "location_unavailable"}

    # Build response structure
    result = {
        "status": "ok",
        "latitude": latitude,
        "longitude": longitude,
        "temperature_c": weather_data["temperature_c"],
        "temperature_f": weather_data["temperature_f"],
        "weathercode": weather_data["weathercode"],
        "wind_speed": weather_data.get("wind_speed", 0.0),
        "humidity": weather_data.get("humidity", 0.0),
        "timestamp": timestamp,
        "user_id": str(user_id),
        "fetched_at": weather_data["fetched_at"]
    }

    # Save in isolated cache
    WEATHER_CACHE[cache_key] = result
    return result
