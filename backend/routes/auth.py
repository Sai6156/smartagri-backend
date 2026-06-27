"""
Stateless authentication — no user table needed.
SHA256(email + password) = deterministic user_id.
Works for any number of sign-ups without storing credentials.
"""

import hashlib
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import jwt

router   = APIRouter(prefix="/api/auth", tags=["auth"])
SECRET   = os.getenv("JWT_SECRET", "smartagri_jwt_secret_2026")
ALG      = "HS256"
DAYS     = 30


class AuthRequest(BaseModel):
    email:    str
    password: str
    name:     str = ""


def _user_id(email: str, password: str) -> str:
    raw = f"{email.lower().strip()}:{password}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]


def _make_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "user_id": user_id,
        "email":   email,
        "name":    name,
        "exp":     datetime.now(timezone.utc) + timedelta(days=DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.split(" ", 1)[1]
    return decode_token(token)


@router.post("/signup")
async def signup(req: AuthRequest):
    """
    Stateless sign-up: hashes credentials to produce a stable user_id.
    No database entry is created. Same credentials always produce same user_id.
    """
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    user_id = _user_id(req.email, req.password)
    token   = _make_token(user_id, req.email, req.name)
    return {
        "user_id":  user_id,
        "email":    req.email,
        "name":     req.name,
        "token":    token,
        "message":  "Account created successfully.",
    }


@router.post("/login")
async def login(req: AuthRequest):
    """
    Stateless login: derives user_id from credentials — same as sign-up.
    No password verification against a database (stateless by design).
    """
    user_id = _user_id(req.email, req.password)
    token   = _make_token(user_id, req.email, req.name)
    return {
        "user_id": user_id,
        "email":   req.email,
        "name":    req.name,
        "token":   token,
        "message": "Login successful.",
    }


@router.get("/me")
async def me(authorization: str = Header(default="")):
    user = get_current_user(authorization)
    return {
        "user_id": user["user_id"],
        "email":   user["email"],
        "name":    user.get("name", ""),
    }
