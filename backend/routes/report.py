from fastapi import APIRouterfrom pydantic import BaseModel
from backend.services.llm import generate_crop_report, generate_risk_forecast
from backend.services.weather_service import fetch_weather_summary
from backend.db import get_history

router = APIRouter(prefix="/api/report", tags=["AI Reports"])


class ReportRequest(BaseModel):
    class_name:   str
    display_name: str
    crop:         str
    confidence:   float
    severity:     str
    remedies:     list[str]
    fertilizers:  list[str]
    prevention:   str
    lat:          float = 0.0
    lon:          float = 0.0
    location:     str   = ""


class RiskRequest(BaseModel):
    crop:     str
    lat:      float = 0.0
    lon:      float = 0.0
    location: str   = ""


@router.post("/generate")
async def generate_report(req: ReportRequest):
    """
    Generate a comprehensive AI farm advisory report for a detected disease.
    Uses OpenRouter (google/gemma-4-31b-it:free).
    """
    weather = fetch_weather_summary(req.lat, req.lon) if req.lat and req.lon else {}
    location = req.location or weather.get("location", "")

    report_md = generate_crop_report(
        disease_name=req.display_name,
        crop=req.crop,
        confidence=req.confidence,
        severity=req.severity,
        remedies=req.remedies,
        fertilizers=req.fertilizers,
        prevention=req.prevention,
        weather=weather,
        location=location,
    )

    return {
        "report":   report_md,
        "weather":  weather,
        "location": location,
        "disease":  req.display_name,
        "crop":     req.crop,
    }


@router.post("/risk-forecast")
async def risk_forecast(req: RiskRequest):
    """
    Predict disease outbreak risk for a given crop + location + weather.
    Pulls last 5 detected diseases from history as context.
    """
    weather = fetch_weather_summary(req.lat, req.lon) if req.lat and req.lon else {}
    location = req.location or weather.get("location", "")

    # Pull recent disease detections from DB as context
    history  = get_history(limit=10)
    recent_diseases = list({
        h["display_name"] for h in history
        if h.get("crop", "").lower() == req.crop.lower()
    })[:5]

    forecast_md = generate_risk_forecast(
        crop=req.crop,
        location=location,
        weather=weather,
        recent_diseases=recent_diseases,
    )

    return {
        "forecast":        forecast_md,
        "crop":            req.crop,
        "location":        location,
        "weather":         weather,
        "recent_diseases": recent_diseases,
    }
