"""
WeatherAPI.com integration — secondary weather source.
Docs: https://www.weatherapi.com/docs/
Free tier: 1M calls/month
"""

import os
import requests

WEATHERAPI_BASE = "http://api.weatherapi.com/v1"


def _irrigation_advice(temp_c: float, humidity: float, precip_mm: float) -> str:
    if precip_mm > 5:
        return "No irrigation needed — sufficient rainfall detected."
    if humidity > 80:
        return "Low irrigation needed — high ambient humidity."
    if temp_c > 35:
        return "High irrigation needed — extreme heat. Water early morning or evening."
    if temp_c > 28:
        return "Moderate irrigation recommended. Water every 2 days."
    return "Normal irrigation schedule. Water every 3-4 days."


def _farming_alerts(temp_c: float, humidity: float, condition: str) -> list[str]:
    alerts = []
    cond = condition.lower()
    if temp_c > 40:
        alerts.append("EXTREME HEAT WARNING: Use shade nets. Increase irrigation.")
    if temp_c < 5:
        alerts.append("FROST RISK: Cover sensitive crops overnight.")
    if humidity > 85:
        alerts.append("HIGH HUMIDITY: Elevated fungal disease risk. Inspect crops.")
    if "thunder" in cond or "storm" in cond:
        alerts.append("SEVERE WEATHER: Delay fieldwork. Secure equipment.")
    if "drizzle" in cond and humidity > 80:
        alerts.append("BLIGHT RISK: Apply preventive fungicide in wet conditions.")
    return alerts


def get_current_weather(lat: float, lon: float) -> dict:
    api_key = os.getenv("WEATHERAPI_KEY", "")
    if not api_key:
        return {"available": False, "reason": "WeatherAPI key not configured."}

    try:
        resp = requests.get(
            f"{WEATHERAPI_BASE}/current.json",
            params={"key": api_key, "q": f"{lat},{lon}", "aqi": "no"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {"available": False, "reason": f"WeatherAPI error {resp.status_code}"}

        d         = resp.json()
        current   = d["current"]
        location  = d["location"]
        temp_c    = current["temp_c"]
        humidity  = current["humidity"]
        precip_mm = current["precip_mm"]
        condition = current["condition"]["text"]

        return {
            "available":         True,
            "source":            "WeatherAPI",
            "location":          f"{location['name']}, {location['region']}, {location['country']}",
            "temperature_c":     temp_c,
            "feels_like_c":      current["feelslike_c"],
            "humidity_pct":      humidity,
            "wind_speed_kph":    current["wind_kph"],
            "pressure_mb":       current["pressure_mb"],
            "visibility_km":     current["vis_km"],
            "uv_index":          current["uv"],
            "precip_mm":         precip_mm,
            "weather":           condition,
            "is_day":            bool(current["is_day"]),
            "irrigation_advice": _irrigation_advice(temp_c, humidity, precip_mm),
            "farming_alerts":    _farming_alerts(temp_c, humidity, condition),
        }
    except Exception as e:
        return {"available": False, "reason": str(e)}


def get_forecast(lat: float, lon: float, days: int = 5) -> dict:
    api_key = os.getenv("WEATHERAPI_KEY", "")
    if not api_key:
        return {"available": False, "reason": "WeatherAPI key not configured."}

    try:
        resp = requests.get(
            f"{WEATHERAPI_BASE}/forecast.json",
            params={"key": api_key, "q": f"{lat},{lon}", "days": days, "aqi": "no"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {"available": False, "reason": f"WeatherAPI error {resp.status_code}"}

        d        = resp.json()
        location = d["location"]
        forecast = []
        for day in d["forecast"]["forecastday"]:
            forecast.append({
                "date":        day["date"],
                "max_temp_c":  day["day"]["maxtemp_c"],
                "min_temp_c":  day["day"]["mintemp_c"],
                "avg_temp_c":  day["day"]["avgtemp_c"],
                "humidity":    day["day"]["avghumidity"],
                "rain_chance": day["day"]["daily_chance_of_rain"],
                "precip_mm":   day["day"]["totalprecip_mm"],
                "condition":   day["day"]["condition"]["text"],
                "uv_index":    day["day"]["uv"],
            })
        return {
            "available": True,
            "source":    "WeatherAPI",
            "location":  f"{location['name']}, {location['country']}",
            "forecast":  forecast,
        }
    except Exception as e:
        return {"available": False, "reason": str(e)}
