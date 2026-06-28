from fastapi import APIRouter, Query, Header
from backend.db import get_history, get_stats
from backend.routes.auth import get_current_user

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def prediction_history(
    limit: int = 50,
    authorization: str = Header(default=""),
):
    user = get_current_user(authorization)
    return get_history(limit, user["user_id"])


@router.get("/stats")
async def dashboard_stats(authorization: str = Header(default="")):
    user = get_current_user(authorization)
    return get_stats(user["user_id"])
