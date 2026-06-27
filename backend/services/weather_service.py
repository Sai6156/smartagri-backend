"""
Unified weather fetch — India-optimised provider chain.
WeatherAPI → Open-Meteo → OpenWeatherMap
"""

import os
import requests

from backend.services.weather_api import get_current_weather as weatherapi_raw
from backend.services.open_meteo import get_current_weather as open_meteo_raw
from backend.services.geocoding import reverse_geocode

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


def _normalize_weatherapi(data: dict) -> dict:
    wind_kph = data.get("wind_speed_kph", 0)
    condition = data.get("weather", data.get("description", ""))
    loc = data.get("location", "")
    # WeatherAPI returns "Warangal, Telangana, India" — use first segment as display city
    city = loc.split(",")[0].strip() if loc else loc
    return {
        "source": "WeatherAPI",
        "location": city or loc,
        "location_full": loc,
        "temperature_c": data["temperature_c"],
        "feels_like_c": data["feels_like_c"],
        "humidity_pct": data["humidity_pct"],
        "wind_speed_ms": round(wind_kph / 3.6, 1),
        "weather": condition,
        "description": condition,
        "rain_1h_mm": data.get("precip_mm", 0),
        "irrigation_advice": data.get("irrigation_advice", ""),
        "farming_alerts": data.get("farming_alerts", []),
    }


def _fetch_owm(lat: float, lon: float, location_name: str = "") -> dict | None:
    key = os.getenv("OPENWEATHER_API_KEY", "")
    if not key:
        return None
    try:
        resp = requests.get(
            f"{OWM_BASE}/weather",
            params={"lat": lat, "lon": lon, "appid": key, "units": "metric"},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        d = resp.json()
        temp = d["main"]["temp"]
        humidity = d["main"]["humidity"]
        rain_1h = d.get("rain", {}).get("1h", 0.0)
        weather_main = d["weather"][0]["main"]
        return {
            "source": "OpenWeatherMap",
            "location": location_name or d.get("name", ""),
            "temperature_c": temp,
            "feels_like_c": d["main"]["feels_like"],
            "humidity_pct": humidity,
            "wind_speed_ms": d["wind"]["speed"],
            "weather": weather_main,
            "description": d["weather"][0]["description"],
            "rain_1h_mm": rain_1h,
            "irrigation_advice": _irrigation_advice(temp, humidity, rain_1h),
            "farming_alerts": _farming_alerts(temp, humidity, weather_main),
        }
    except Exception:
        return None


def fetch_current_weather(lat: float, lon: float, location_name: str = "") -> dict:
    """
    Fetch weather using the best available provider.
    Resolves a human-readable Indian city name when possible.
    """
    if not location_name:
        geo = reverse_geocode(lat, lon)
        location_name = geo.get("city", "")

    # 1) WeatherAPI — best Indian place names + accurate conditions
    wa = weatherapi_raw(lat, lon)
    if wa.get("available"):
        result = _normalize_weatherapi(wa)
        if location_name and location_name != "Your location":
            result["location"] = location_name
        return result

    # 2) Open-Meteo — free, coordinate-accurate across India
    om = open_meteo_raw(lat, lon, location_name)
    if om.get("available"):
        return om

    # 3) OpenWeatherMap — legacy fallback
    owm = _fetch_owm(lat, lon, location_name)
    if owm:
        return owm

    raise RuntimeError(
        "No weather provider available. Configure WEATHERAPI_KEY or OPENWEATHER_API_KEY."
    )


def fetch_weather_summary(lat: float, lon: float) -> dict:
    """Lightweight weather dict for reports (temperature, humidity, description)."""
    try:
        w = fetch_current_weather(lat, lon)
        return {
            "temperature_c": w.get("temperature_c"),
            "humidity_pct": w.get("humidity_pct"),
            "rain_1h_mm": w.get("rain_1h_mm", 0),
            "description": w.get("description", ""),
            "location": w.get("location", ""),
        }
    except Exception:
        return {}
