import os
import requests
from fastapi import APIRouter, HTTPException, Query
from backend.services.weather_api import get_current_weather as weatherapi_current, get_forecast as weatherapi_forecast
from backend.services.location import get_location_from_ip

router = APIRouter(prefix="/api", tags=["weather"])

OWM_BASE = "https://api.openweathermap.org/data/2.5"


def _irrigation_advice(temp: float, humidity: float, rain_1h: float) -> str:
    if rain_1h > 5:
        return "No irrigation needed — sufficient rainfall detected."
    if humidity > 80:
        return "Low irrigation needed — high ambient humidity."
    if temp > 35:
        return "High irrigation needed — extreme heat. Water early morning or evening."
    if temp > 28:
        return "Moderate irrigation recommended. Water every 2 days."
    return "Normal irrigation schedule. Water every 3-4 days."


def _farming_alerts(temp: float, humidity: float, weather_main: str) -> list[str]:
    alerts = []
    if temp > 40:
        alerts.append("EXTREME HEAT WARNING: Protect crops with shade nets. Increase irrigation.")
    if temp < 5:
        alerts.append("FROST RISK: Cover sensitive crops overnight.")
    if humidity > 85:
        alerts.append("HIGH HUMIDITY: Disease risk elevated. Inspect for fungal infections.")
    if weather_main in ("Thunderstorm", "Tornado"):
        alerts.append("SEVERE WEATHER: Secure structures. Delay fieldwork.")
    if weather_main == "Drizzle" and humidity > 80:
        alerts.append("BLIGHT RISK: Wet conditions favour late blight. Apply preventive fungicide.")
    return alerts


@router.get("/location/detect")
async def detect_location():
    """Auto-detect approximate location from server IP (ipinfo.io)."""
    return get_location_from_ip()


@router.get("/weather")
async def get_weather(
    lat: float = Query(None, description="Latitude (leave empty to auto-detect)"),
    lon: float = Query(None, description="Longitude (leave empty to auto-detect)"),
    source: str = Query("owm", description="Weather source: owm | weatherapi | both"),
):
    # Auto-detect location if not provided
    if lat is None or lon is None:
        loc  = get_location_from_ip()
        lat  = loc["lat"]
        lon  = loc["lon"]

    # WeatherAPI source
    if source == "weatherapi":
        result = weatherapi_current(lat, lon)
        if not result.get("available"):
            raise HTTPException(status_code=503, detail=result.get("reason", "WeatherAPI unavailable."))
        return result

    # Both sources — merge
    if source == "both":
        owm_data = _fetch_owm(lat, lon)
        wa_data  = weatherapi_current(lat, lon)
        return {
            "owm":        owm_data,
            "weatherapi": wa_data,
            "auto_lat":   lat,
            "auto_lon":   lon,
        }

    # Default: OpenWeatherMap
    return _fetch_owm(lat, lon)


def _fetch_owm(lat: float, lon: float) -> dict:
    key = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OpenWeatherMap API key not configured.")

    url  = f"{OWM_BASE}/weather?lat={lat}&lon={lon}&appid={key}&units=metric"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Weather API error.")
    d = resp.json()

    temp         = d["main"]["temp"]
    humidity     = d["main"]["humidity"]
    rain_1h      = d.get("rain", {}).get("1h", 0.0)
    weather_main = d["weather"][0]["main"]

    return {
        "source":            "OpenWeatherMap",
        "location":          d.get("name", ""),
        "temperature_c":     temp,
        "feels_like_c":      d["main"]["feels_like"],
        "humidity_pct":      humidity,
        "pressure_hpa":      d["main"]["pressure"],
        "wind_speed_ms":     d["wind"]["speed"],
        "weather":           weather_main,
        "description":       d["weather"][0]["description"],
        "rain_1h_mm":        rain_1h,
        "irrigation_advice": _irrigation_advice(temp, humidity, rain_1h),
        "farming_alerts":    _farming_alerts(temp, humidity, weather_main),
    }


@router.get("/weather/forecast")
async def get_forecast(
    lat: float = Query(None),
    lon: float = Query(None),
    source: str = Query("owm", description="owm | weatherapi"),
):
    if lat is None or lon is None:
        loc = get_location_from_ip()
        lat, lon = loc["lat"], loc["lon"]

    if source == "weatherapi":
        result = weatherapi_forecast(lat, lon)
        if not result.get("available"):
            raise HTTPException(status_code=503, detail=result.get("reason"))
        return result

    # OWM forecast
    key  = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OpenWeatherMap API key not configured.")

    url  = f"{OWM_BASE}/forecast?lat={lat}&lon={lon}&appid={key}&units=metric&cnt=16"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Forecast API error.")
    d    = resp.json()

    return {
        "source":   "OpenWeatherMap",
        "city":     d["city"]["name"],
        "forecast": [
            {
                "datetime":   item["dt_txt"],
                "temp_c":     item["main"]["temp"],
                "humidity":   item["main"]["humidity"],
                "weather":    item["weather"][0]["main"],
                "rain_3h_mm": item.get("rain", {}).get("3h", 0.0),
            }
            for item in d["list"]
        ],
    }
