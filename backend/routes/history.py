from fastapi import APIRouter, Query, Header
from backend.db import get_history, get_stats

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def prediction_history(
    limit: int = 50,
    authorization: str = Header(default=""),
):
    user_id = ""
    if authorization.startswith("Bearer "):
        try:
            from backend.routes.auth import decode_token
            payload = decode_token(authorization.split(" ", 1)[1])
            user_id = payload.get("user_id", "")
        except Exception:
            pass
    return get_history(limit, user_id)


@router.get("/stats")
async def dashboard_stats(authorization: str = Header(default="")):
    user_id = ""
    if authorization.startswith("Bearer "):
        try:
            from backend.routes.auth import decode_token
            payload = decode_token(authorization.split(" ", 1)[1])
            user_id = payload.get("user_id", "")
        except Exception:
            pass
    return get_stats(user_id)
