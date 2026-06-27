"""
GPS / IP-based location detection.
Uses ipinfo.io (free, no key needed for basic use).
"""

import requests


def get_location_from_ip() -> dict:
    """
    Detect approximate location from the server's public IP.
    For production, the client should send their GPS coordinates directly.
    Returns lat, lon, city, region, country.
    """
    try:
        resp = requests.get("https://ipinfo.io/json", timeout=8)
        if resp.status_code != 200:
            return _default_location()

        data = resp.json()
        loc  = data.get("loc", "17.3850,78.4867")  # default: Hyderabad
        lat, lon = map(float, loc.split(","))

        return {
            "lat":     lat,
            "lon":     lon,
            "city":    data.get("city", "Unknown"),
            "region":  data.get("region", ""),
            "country": data.get("country", ""),
            "ip":      data.get("ip", ""),
            "detected": True,
        }
    except Exception:
        return _default_location()


def _default_location() -> dict:
    return {
        "lat":      17.3850,
        "lon":      78.4867,
        "city":     "Hyderabad",
        "region":   "Telangana",
        "country":  "IN",
        "ip":       "",
        "detected": False,
    }
