from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from backend.db import update_prediction, get_prediction_thumbnail
from backend.routes.auth import get_current_user

router = APIRouter(prefix="/api", tags=["scans"])


class PredictionUpdateRequest(BaseModel):
    image_data: str = ""
    plant: dict | None = None
    weather: dict | None = None
    crop_report: str = ""
    risk_forecast: str = ""
    iot_data: dict | list | str | None = None
    lat: float = 0.0
    lon: float = 0.0
    location: str = ""


@router.put("/predictions/{prediction_id}")
async def sync_prediction(
    prediction_id: int,
    req: PredictionUpdateRequest,
    authorization: str = Header(default=""),
):
    """Persist full scan payload after the frontend pipeline completes."""
    user = get_current_user(authorization)
    ok = update_prediction(
        prediction_id,
        user["user_id"],
        {
            "image_data": req.image_data or None,
            "plant": req.plant,
            "weather": req.weather,
            "crop_report": req.crop_report,
            "risk_forecast": req.risk_forecast,
            "iot_data": req.iot_data,
            "lat": req.lat,
            "lon": req.lon,
            "location": req.location,
        },
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Prediction not found.")
    return {"ok": True, "id": prediction_id}


@router.get("/predictions/{prediction_id}/thumbnail")
async def prediction_thumbnail(
    prediction_id: int,
    authorization: str = Header(default=""),
):
    """Return JPEG thumbnail bytes for history lists (auth required)."""
    user = get_current_user(authorization)
    data = get_prediction_thumbnail(prediction_id, user["user_id"])
    if not data:
        raise HTTPException(status_code=404, detail="Thumbnail not found.")
    return Response(content=data, media_type="image/jpeg")
