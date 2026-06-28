"""
Registered user accounts — email + bcrypt password hash in SQLite.
"""

import re
import uuid
import bcrypt
from datetime import datetime, timezone

from backend.db import _conn

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailAlreadyRegistered(Exception):
    pass


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> None:
    if not EMAIL_RE.match(normalize_email(email)):
        raise ValueError("Enter a valid email address.")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_user(email: str, password: str, name: str) -> dict:
    validate_email(email)
    email_norm = normalize_email(email)
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")
    if not name.strip():
        raise ValueError("Name is required.")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    created = datetime.now(timezone.utc).isoformat()

    con = _conn()
    try:
        con.execute(
            """
            INSERT INTO users (id, email, password_hash, name, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, email_norm, pw_hash, name.strip(), created),
        )
        con.commit()
    except Exception as e:
        if "UNIQUE" in str(e).upper():
            raise EmailAlreadyRegistered(email_norm) from e
        raise
    finally:
        con.close()

    return {
        "id": user_id,
        "email": email_norm,
        "name": name.strip(),
        "created_at": created,
    }


def get_user_by_email(email: str) -> dict | None:
    email_norm = normalize_email(email)
    con = _conn()
    row = con.execute(
        "SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?",
        (email_norm,),
    ).fetchone()
    con.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    con = _conn()
    row = con.execute(
        "SELECT id, email, name, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    con.close()
    return dict(row) if row else None


def authenticate_user(email: str, password: str) -> dict | None:
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "created_at": user["created_at"],
    }
