"""
Mappls (MapmyIndia) — India's most accurate geocoding for towns, districts & villages.
Uses OAuth (client id/secret) for place search and REST key for reverse geocoding.
"""

import os
import time
import requests

OAUTH_URL = "https://outpost.mappls.com/api/security/oauth/token"
ATLAS_SEARCH = "https://atlas.mappls.com/api/places/search/json"
ADVANCED_BASE = "https://apis.mappls.com/advancedmaps/v1"

_token_cache: dict = {"token": None, "expires_at": 0.0}


def _rest_key() -> str:
    return os.getenv("MAPPLS_REST_KEY", "")


def _client_id() -> str:
    return os.getenv("MAPPLS_CLIENT_ID", "")


def _client_secret() -> str:
    return os.getenv("MAPPLS_CLIENT_SECRET", "")


def is_configured() -> bool:
    return bool(_rest_key() or (_client_id() and _client_secret()))


def _oauth_token() -> str | None:
    if not _client_id() or not _client_secret():
        return None

    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    try:
        resp = requests.post(
            OAUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": _client_id(),
                "client_secret": _client_secret(),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        _token_cache["token"] = data.get("access_token")
        _token_cache["expires_at"] = now + int(data.get("expires_in", 3600)) - 120
        return _token_cache["token"]
    except Exception:
        return None


def _auth_headers() -> dict:
    token = _oauth_token()
    return {"Authorization": f"bearer {token}"} if token else {}


def _coords_from_open_meteo(name: str) -> tuple[float, float] | None:
    """Resolve lat/lon when Mappls search returns place name without coordinates."""
    try:
        resp = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": name, "count": 3, "language": "en", "country": "IN"},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        if not results:
            return None
        name_lower = name.lower()
        for r in results:
            if r.get("name", "").lower() == name_lower:
                return float(r["latitude"]), float(r["longitude"])
        r = results[0]
        return float(r["latitude"]), float(r["longitude"])
    except Exception:
        return None


def reverse_geocode(lat: float, lon: float) -> dict | None:
    """
    Reverse geocode GPS coordinates to Indian address.
    REST key in URL path: /advancedmaps/v1/{key}/rev_geocode
    """
    key = _rest_key()
    if not key:
        return None

    try:
        resp = requests.get(
            f"{ADVANCED_BASE}/{key}/rev_geocode",
            params={"lat": lat, "lng": lon},
            timeout=12,
        )
        if resp.status_code != 200:
            # OAuth fallback on same endpoint
            headers = _auth_headers()
            if not headers:
                return None
            resp = requests.get(
                f"{ADVANCED_BASE}/rev_geocode",
                params={"lat": lat, "lng": lon},
                headers=headers,
                timeout=12,
            )
            if resp.status_code != 200:
                return None

        results = resp.json().get("results", [])
        if not results:
            return None

        r = results[0]
        city = (
            r.get("city")
            or r.get("village")
            or (r.get("district", "") or "").replace(" District", "")
            or r.get("subDistrict", "")
            or "Your location"
        )
        return {
            "lat": lat,
            "lon": lon,
            "city": city,
            "region": r.get("state", ""),
            "country": "India",
            "pincode": r.get("pincode", ""),
            "formatted_address": r.get("formatted_address", ""),
            "source": "mappls",
        }
    except Exception:
        return None


def search_places(q: str, limit: int = 6) -> list[dict]:
    """Search Indian places via Mappls Atlas autosuggest."""
    headers = _auth_headers()
    if not headers:
        return []

    try:
        resp = requests.get(
            ATLAS_SEARCH,
            params={"query": q, "region": "IND"},
            headers=headers,
            timeout=10,
        )
        if resp.status_code != 200:
            return []

        locations = resp.json().get("suggestedLocations", [])
        if not locations:
            return []

        # One Open-Meteo lookup for the query — reuse for city matches
        query_name = q.split(",")[0].strip()
        default_coords = _coords_from_open_meteo(query_name)

        results: list[dict] = []

        for loc in locations[:limit]:
            place_type = loc.get("type", "")
            name = loc.get("placeName", q)
            address = loc.get("placeAddress", "")
            alt = loc.get("alternateName", "")

            region = address if place_type == "CITY" else _extract_state(address)
            city = name

            coords = default_coords if place_type == "CITY" and default_coords else None
            if not coords and place_type != "CITY":
                coords = _coords_from_open_meteo(name)

            if not coords:
                continue

            lat, lon = coords
            label_parts = [name]
            if alt:
                label_parts.append(alt)
            if region:
                label_parts.append(region)
            label_parts.append("India")

            results.append({
                "lat": lat,
                "lon": lon,
                "city": city,
                "region": region,
                "country": "India",
                "label": ", ".join(dict.fromkeys(label_parts)),
                "source": "mappls",
                "place_type": place_type,
            })

        return results
    except Exception:
        return []


def _extract_state(address: str) -> str:
    """Pull state name from a comma-separated Indian address string."""
    for part in reversed(address.split(",")):
        part = part.strip()
        if part and not part.isdigit() and len(part) > 2:
            return part
    return address
