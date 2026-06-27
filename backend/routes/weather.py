import os
import requests
from fastapi import APIRouter, HTTPException, Query
from backend.services.weather_api import get_current_weather as weatherapi_current, get_forecast as weatherapi_forecast
from backend.services.weather_service import fetch_current_weather, _fetch_owm
from backend.services.geocoding import search_city as geo_search, reverse_geocode as geo_reverse
from backend.services.location import get_location_from_ip

router = APIRouter(prefix="/api", tags=["weather"])

OWM_BASE = "https://api.openweathermap.org/data/2.5"


@router.get("/location/detect")
async def detect_location():
    """Server-side IP geolocation (Render host IP — not the user's device). Prefer browser GPS on client."""
    return get_location_from_ip()


@router.get("/location/reverse")
async def reverse_geocode(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """
    Reverse geocode lat/lon to city name.
    Chain: WeatherAPI → OpenStreetMap Nominatim (India-aware).
    """
    return geo_reverse(lat, lon)


@router.get("/location/search")
async def search_city(q: str = Query(..., min_length=2)):
    """
    Search city/town/village — optimised for India.
    Chain: WeatherAPI → Open-Meteo Geocoding → Nominatim (countrycodes=in).
    """
    results = geo_search(q)
    if not results:
        raise HTTPException(status_code=404, detail=f"No locations found for '{q}'. Try adding state, e.g. Warangal, Telangana")
    return results


@router.get("/weather")
async def get_weather(
    lat: float = Query(None, description="Latitude"),
    lon: float = Query(None, description="Longitude"),
    source: str = Query("auto", description="auto | weatherapi | openmeteo | owm | both"),
    location: str = Query("", description="Display name override, e.g. Warangal"),
):
    if lat is None or lon is None:
        loc = get_location_from_ip()
        lat = loc["lat"]
        lon = loc["lon"]

    loc_name = location.strip()

    if source == "weatherapi":
        result = weatherapi_current(lat, lon)
        if not result.get("available"):
            raise HTTPException(status_code=503, detail=result.get("reason", "WeatherAPI unavailable."))
        from backend.services.weather_service import _normalize_weatherapi
        return _normalize_weatherapi(result)

    if source == "openmeteo":
        from backend.services.open_meteo import get_current_weather as om
        result = om(lat, lon, loc_name)
        if not result.get("available"):
            raise HTTPException(status_code=503, detail=result.get("reason", "Open-Meteo unavailable."))
        return result

    if source == "owm":
        data = _fetch_owm(lat, lon, loc_name)
        if not data:
            raise HTTPException(status_code=503, detail="OpenWeatherMap unavailable.")
        return data

    if source == "both":
        try:
            primary = fetch_current_weather(lat, lon, loc_name)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))
        owm_data = _fetch_owm(lat, lon, loc_name)
        wa_data = weatherapi_current(lat, lon)
        return {
            "primary": primary,
            "owm": owm_data,
            "weatherapi": wa_data,
            "auto_lat": lat,
            "auto_lon": lon,
        }

    # Default: auto chain (WeatherAPI → Open-Meteo → OWM)
    try:
        return fetch_current_weather(lat, lon, loc_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/weather/forecast")
async def get_forecast(
    lat: float = Query(None),
    lon: float = Query(None),
    source: str = Query("weatherapi", description="weatherapi | owm"),
):
    if lat is None or lon is None:
        loc = get_location_from_ip()
        lat, lon = loc["lat"], loc["lon"]

    if source == "weatherapi":
        result = weatherapi_forecast(lat, lon)
        if not result.get("available"):
            raise HTTPException(status_code=503, detail=result.get("reason"))
        return result

    key = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OpenWeatherMap API key not configured.")

    url = f"{OWM_BASE}/forecast?lat={lat}&lon={lon}&appid={key}&units=metric&cnt=16"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Forecast API error.")
    d = resp.json()

    return {
        "source": "OpenWeatherMap",
        "city": d["city"]["name"],
        "forecast": [
            {
                "datetime": item["dt_txt"],
                "temp_c": item["main"]["temp"],
                "humidity": item["main"]["humidity"],
                "weather": item["weather"][0]["main"],
                "rain_3h_mm": item.get("rain", {}).get("3h", 0.0),
            }
            for item in d["list"]
        ],
    }
