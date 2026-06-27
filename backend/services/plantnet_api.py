"""
PlantNet API — plant species identification.
Docs: https://my.plantnet.org/doc/openapi
Free API key available at: https://my.plantnet.org
"""

import os
import requests

PLANTNET_BASE = "https://my-api.plantnet.org/v2/identify"


def identify_plant(image_bytes: bytes, filename: str = "leaf.jpg") -> dict:
    """
    Identify plant species using PlantNet API.
    Returns top species matches with scores and common names.
    """
    api_key = os.getenv("PLANTNET_API_KEY", "")
    if not api_key:
        return {"available": False, "reason": "PlantNet API key not configured."}

    try:
        resp = requests.post(
            f"{PLANTNET_BASE}/all",
            params={"api-key": api_key, "nb-results": 5, "lang": "en"},
            files={"images": (filename, image_bytes, "image/jpeg")},
            data={"organs": ["leaf"]},
            timeout=20,
        )

        if resp.status_code == 404:
            # PlantNet returns 404 when no plant is found in image
            return {
                "available": True,
                "found":     False,
                "message":   "No plant detected in the image. Try a clearer leaf photo.",
                "results":   [],
            }

        if resp.status_code != 200:
            return {
                "available": False,
                "reason":    f"PlantNet returned {resp.status_code}: {resp.text[:200]}",
            }

        data    = resp.json()
        results = []
        for item in data.get("results", [])[:5]:
            species = item.get("species", {})
            results.append({
                "scientific_name": species.get("scientificNameWithoutAuthor", ""),
                "common_names":    species.get("commonNames", [])[:3],
                "family":          species.get("family", {}).get("scientificNameWithoutAuthor", ""),
                "genus":           species.get("genus", {}).get("scientificNameWithoutAuthor", ""),
                "score":           round(item.get("score", 0) * 100, 2),
            })

        best = results[0] if results else {}
        return {
            "available":       True,
            "found":           bool(results),
            "best_match":      best.get("scientific_name", ""),
            "best_score":      best.get("score", 0),
            "common_names":    best.get("common_names", []),
            "family":          best.get("family", ""),
            "results":         results,
            "remaining_quota": data.get("remainingIdentificationRequests", "N/A"),
        }

    except requests.Timeout:
        return {"available": False, "reason": "PlantNet API timed out."}
    except Exception as e:
        return {"available": False, "reason": str(e)}
