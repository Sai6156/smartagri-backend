"""
Geocoding optimised for Indian locations.
Chain: WeatherAPI → Open-Meteo Geocoding → OpenStreetMap Nominatim (countrycodes=in)
"""

import os
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OPEN_METEO_GEO = "https://geocoding-api.open-meteo.com/v1"
WEATHERAPI_BASE = "http://api.weatherapi.com/v1"
USER_AGENT = "SmartAgri/1.0 (smart-agriculture-app)"


def _label(city: str, region: str, country: str) -> str:
    return ", ".join(x for x in [city, region, country] if x)


def _india_query(q: str) -> str:
    lower = q.lower()
    if "india" in lower or ", in" in lower:
        return q
    return f"{q}, India"


def search_city(q: str, limit: int = 8) -> list[dict]:
    """Search cities/towns — biased toward India."""
    results: list[dict] = []
    seen: set[tuple[float, float]] = set()

    def add(lat: float, lon: float, city: str, region: str, country: str, source: str):
        key = (round(lat, 3), round(lon, 3))
        if key in seen:
            return
        seen.add(key)
        results.append({
            "lat": lat,
            "lon": lon,
            "city": city,
            "region": region,
            "country": country,
            "label": _label(city, region, country),
            "source": source,
        })

    # 1) WeatherAPI — strong Indian district/town coverage
    wa_key = os.getenv("WEATHERAPI_KEY", "")
    if wa_key:
        try:
            resp = requests.get(
                f"{WEATHERAPI_BASE}/search.json",
                params={"key": wa_key, "q": _india_query(q)},
                timeout=10,
            )
            if resp.status_code == 200:
                for p in resp.json():
                    add(
                        float(p["lat"]),
                        float(p["lon"]),
                        p.get("name", q),
                        p.get("region", ""),
                        p.get("country", ""),
                        "weatherapi",
                    )
        except Exception:
            pass

    # 2) Open-Meteo geocoding — free, good India coverage, no API key
    try:
        resp = requests.get(
            f"{OPEN_METEO_GEO}/search",
            params={"name": q, "count": limit, "language": "en", "country": "IN"},
            timeout=10,
        )
        if resp.status_code == 200:
            for p in resp.json().get("results", []):
                add(
                    float(p["latitude"]),
                    float(p["longitude"]),
                    p.get("name", q),
                    p.get("admin1", ""),
                    p.get("country", "India"),
                    "open-meteo",
                )
    except Exception:
        pass

    # 3) OpenStreetMap Nominatim — villages & taluks
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/search",
            params={
                "q": _india_query(q),
                "countrycodes": "in",
                "format": "json",
                "limit": limit,
                "addressdetails": 1,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=12,
        )
        if resp.status_code == 200:
            for p in resp.json():
                addr = p.get("address", {})
                city = (
                    addr.get("city")
                    or addr.get("town")
                    or addr.get("village")
                    or addr.get("county")
                    or addr.get("state_district")
                    or p.get("name", q)
                )
                add(
                    float(p["lat"]),
                    float(p["lon"]),
                    city,
                    addr.get("state", ""),
                    addr.get("country", "India"),
                    "nominatim",
                )
    except Exception:
        pass

    # Prefer India results, then by source quality
    source_rank = {"weatherapi": 0, "open-meteo": 1, "nominatim": 2}
    results.sort(
        key=lambda r: (
            0 if "india" in r.get("country", "").lower() or r.get("country") == "IN" else 1,
            source_rank.get(r.get("source", ""), 9),
        )
    )
    return results[:limit]


def reverse_geocode(lat: float, lon: float) -> dict:
    """Reverse geocode coordinates to city/region."""
    wa_key = os.getenv("WEATHERAPI_KEY", "")

    # 1) WeatherAPI — location block from current weather lookup
    if wa_key:
        try:
            resp = requests.get(
                f"{WEATHERAPI_BASE}/current.json",
                params={"key": wa_key, "q": f"{lat},{lon}", "aqi": "no"},
                timeout=10,
            )
            if resp.status_code == 200:
                loc = resp.json().get("location", {})
                name = loc.get("name", "")
                if name:
                    return {
                        "lat": lat,
                        "lon": lon,
                        "city": name,
                        "region": loc.get("region", ""),
                        "country": loc.get("country", ""),
                        "source": "weatherapi",
                    }
        except Exception:
            pass

    # 2) Nominatim reverse
    try:
        resp = requests.get(
            f"{NOMINATIM_URL}/reverse",
            params={"lat": lat, "lon": lon, "format": "json", "addressdetails": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=12,
        )
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get("address", {})
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("county")
                or addr.get("state_district")
                or data.get("name", "Your location")
            )
            return {
                "lat": lat,
                "lon": lon,
                "city": city,
                "region": addr.get("state", ""),
                "country": addr.get("country", "India"),
                "source": "nominatim",
            }
    except Exception:
        pass

    return {
        "lat": lat,
        "lon": lon,
        "city": "Your location",
        "region": "",
        "country": "",
        "source": "none",
    }
