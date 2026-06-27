"""
Plant.id API integration — secondary disease identification.
Docs: https://plant.id/api/v3
Free tier: 100 requests/month
"""

import os
import base64
import requests

PLANTID_BASE = "https://plant.id/api/v3"


def identify_disease(image_bytes: bytes) -> dict:
    """
    Send image to Plant.id API for disease identification.
    Returns structured result or error dict.
    """
    api_key = os.getenv("PLANTID_API_KEY", "")
    if not api_key:
        return {"available": False, "reason": "Plant.id API key not configured."}

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "images": [b64_image],
        "health": "all",           # request health assessment
        "classification_level": "species",
    }

    try:
        resp = requests.post(
            f"{PLANTID_BASE}/identification",
            json=payload,
            headers={
                "Api-Key": api_key,
                "Content-Type": "application/json",
            },
            timeout=20,
        )

        if resp.status_code != 201 and resp.status_code != 200:
            return {
                "available": False,
                "reason": f"Plant.id API returned {resp.status_code}: {resp.text[:200]}",
            }

        data = resp.json()

        # Extract plant identification
        plant_suggestions = []
        for suggestion in data.get("result", {}).get("classification", {}).get("suggestions", [])[:3]:
            plant_suggestions.append({
                "name":       suggestion.get("name", ""),
                "probability": round(suggestion.get("probability", 0) * 100, 2),
            })

        # Extract disease/health assessment
        diseases = []
        health = data.get("result", {}).get("disease", {})
        is_healthy = health.get("is_healthy", {}).get("binary", True)
        for d in health.get("suggestions", [])[:3]:
            diseases.append({
                "name":        d.get("name", ""),
                "probability": round(d.get("probability", 0) * 100, 2),
                "description": d.get("details", {}).get("description", ""),
                "treatment":   d.get("details", {}).get("treatment", {}).get("chemical", []),
            })

        return {
            "available":         True,
            "is_healthy":        is_healthy,
            "plant_suggestions": plant_suggestions,
            "disease_suggestions": diseases,
        }

    except requests.Timeout:
        return {"available": False, "reason": "Plant.id API request timed out."}
    except Exception as e:
        return {"available": False, "reason": str(e)}


def identify_plant(image_bytes: bytes) -> dict:
    """
    Identify plant species using PlantNet-style via Plant.id.
    """
    api_key = os.getenv("PLANTID_API_KEY", "")
    if not api_key:
        return {"available": False, "reason": "Plant.id API key not configured."}

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    payload   = {"images": [b64_image], "classification_level": "species"}

    try:
        resp = requests.post(
            f"{PLANTID_BASE}/identification",
            json=payload,
            headers={"Api-Key": api_key, "Content-Type": "application/json"},
            timeout=20,
        )
        if resp.status_code not in (200, 201):
            return {"available": False, "reason": f"Status {resp.status_code}"}

        data        = resp.json()
        suggestions = data.get("result", {}).get("classification", {}).get("suggestions", [])
        return {
            "available": True,
            "suggestions": [
                {
                    "name":        s.get("name", ""),
                    "probability": round(s.get("probability", 0) * 100, 2),
                    "common_names": s.get("details", {}).get("common_names", []),
                }
                for s in suggestions[:5]
            ],
        }
    except Exception as e:
        return {"available": False, "reason": str(e)}
