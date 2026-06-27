"""
Open-Meteo — free weather API, no key required.
Good coordinate-based coverage across India (uses national weather models).
Docs: https://open-meteo.com/en/docs
"""

import requests

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

# WMO weather interpretation codes (subset)
WMO_DESC: dict[int, str] = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    95: "thunderstorm",
    96: "thunderstorm with slight hail",
    99: "thunderstorm with heavy hail",
}


def _irrigation_advice(temp: float, humidity: float, rain_mm: float) -> str:
    if rain_mm > 5:
        return "No irrigation needed — sufficient rainfall detected."
    if humidity > 80:
        return "Low irrigation needed — high ambient humidity."
    if temp > 35:
        return "High irrigation needed — extreme heat. Water early morning or evening."
    if temp > 28:
        return "Moderate irrigation recommended. Water every 2 days."
    return "Normal irrigation schedule. Water every 3-4 days."


def _farming_alerts(temp: float, humidity: float, code: int) -> list[str]:
    alerts = []
    desc = WMO_DESC.get(code, "").lower()
    if temp > 40:
        alerts.append("EXTREME HEAT WARNING: Protect crops with shade nets. Increase irrigation.")
    if temp < 5:
        alerts.append("FROST RISK: Cover sensitive crops overnight.")
    if humidity > 85:
        alerts.append("HIGH HUMIDITY: Disease risk elevated. Inspect for fungal infections.")
    if "thunder" in desc:
        alerts.append("SEVERE WEATHER: Secure structures. Delay fieldwork.")
    if "drizzle" in desc or "rain" in desc:
        if humidity > 80:
            alerts.append("BLIGHT RISK: Wet conditions favour fungal diseases. Apply preventive fungicide.")
    return alerts


def get_current_weather(lat: float, lon: float, location_name: str = "") -> dict:
    try:
        resp = requests.get(
            OPEN_METEO,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": (
                    "temperature_2m,relative_humidity_2m,apparent_temperature,"
                    "precipitation,weather_code,wind_speed_10m"
                ),
                "timezone": "auto",
            },
            timeout=12,
        )
        if resp.status_code != 200:
            return {"available": False, "reason": f"Open-Meteo error {resp.status_code}"}

        cur = resp.json().get("current", {})
        temp = float(cur.get("temperature_2m", 0))
        humidity = float(cur.get("relative_humidity_2m", 0))
        rain_mm = float(cur.get("precipitation", 0))
        code = int(cur.get("weather_code", 0))
        wind_ms = float(cur.get("wind_speed_10m", 0)) / 3.6  # km/h → m/s
        desc = WMO_DESC.get(code, "variable conditions")

        return {
            "available": True,
            "source": "Open-Meteo",
            "location": location_name or f"{lat:.2f}°N, {lon:.2f}°E",
            "temperature_c": temp,
            "feels_like_c": float(cur.get("apparent_temperature", temp)),
            "humidity_pct": humidity,
            "wind_speed_ms": round(wind_ms, 1),
            "weather": desc,
            "description": desc,
            "rain_1h_mm": rain_mm,
            "irrigation_advice": _irrigation_advice(temp, humidity, rain_mm),
            "farming_alerts": _farming_alerts(temp, humidity, code),
        }
    except Exception as e:
        return {"available": False, "reason": str(e)}
