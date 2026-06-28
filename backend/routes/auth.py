"""
Authentication — registered users with bcrypt passwords and JWT sessions.
"""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, field_validator

from backend.users import (
    authenticate_user,
    create_user,
    get_user_by_id,
    normalize_email,
    validate_email,
    EmailAlreadyRegistered,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
SECRET = os.getenv("JWT_SECRET", "smartagri_jwt_secret_2026")
ALG = "HS256"
DAYS = 30


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        validate_email(v)
        return normalize_email(v)

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required.")
        return v.strip()


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        validate_email(v)
        return normalize_email(v)


def _make_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(days=DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALG)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session. Please sign in again.")


def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")
    payload = decode_token(token)
    user = get_user_by_id(payload.get("user_id", ""))
    if not user:
        raise HTTPException(status_code=401, detail="Account not found. Please sign up again.")
    return {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
    }


@router.post("/signup")
async def signup(req: SignupRequest):
    """Create a new account. Email must be unique."""
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    try:
        user = create_user(req.email, req.password, req.name)
    except EmailAlreadyRegistered:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered. Please sign in instead.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token = _make_token(user["id"], user["email"], user["name"])
    return {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "token": token,
        "message": "Account created successfully.",
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Sign in only if email is registered and password matches."""
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = _make_token(user["id"], user["email"], user["name"])
    return {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "token": token,
        "message": "Login successful.",
    }


@router.get("/me")
async def me(authorization: str = Header(default="")):
    user = get_current_user(authorization)
    return user
