"""
Database layer — PostgreSQL on Render (DATABASE_URL) or SQLite for local dev.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "smartagri.db"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

USE_POSTGRES = bool(DATABASE_URL)


def _sql(sql: str) -> str:
    return sql.replace("?", "%s") if USE_POSTGRES else sql


def _conn():
    if USE_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con


def _row_to_dict(row) -> dict:
    if row is None:
        return {}
    if isinstance(row, dict):
        return dict(row)
    return dict(row)


def _fetchone(cur):
    row = cur.fetchone()
    return _row_to_dict(row) if row else None


def _fetchall(cur):
    return [_row_to_dict(r) for r in cur.fetchall()]


def _execute(con, sql: str, params=()):
    cur = con.cursor()
    cur.execute(_sql(sql), params)
    return cur


def _last_id(cur, con):
    if USE_POSTGRES:
        row = _fetchone(cur)
        return row["id"] if row else None
    return cur.lastrowid


def init_db():
    con = _conn()
    cur = con.cursor()

    if USE_POSTGRES:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id SERIAL PRIMARY KEY,
                user_id TEXT DEFAULT 'anonymous',
                timestamp TEXT NOT NULL,
                filename TEXT,
                class_name TEXT,
                display_name TEXT,
                crop TEXT,
                confidence DOUBLE PRECISION,
                severity TEXT,
                remedies TEXT,
                fertilizers TEXT,
                prevention TEXT,
                description TEXT,
                top5 TEXT,
                visual_diagnosis TEXT,
                report TEXT,
                dataset_prediction TEXT,
                image_data TEXT,
                plant_json TEXT,
                weather_json TEXT,
                scan_report_json TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                timestamp TEXT NOT NULL,
                to_number TEXT,
                message TEXT,
                status TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        for col, typ in [
            ("dataset_prediction", "TEXT"),
            ("image_data", "TEXT"),
            ("plant_json", "TEXT"),
            ("weather_json", "TEXT"),
            ("scan_report_json", "TEXT"),
        ]:
            try:
                cur.execute(f"ALTER TABLE predictions ADD COLUMN IF NOT EXISTS {col} {typ}")
            except Exception:
                pass
    else:
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS predictions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT DEFAULT 'anonymous',
                timestamp   TEXT NOT NULL,
                filename    TEXT,
                class_name  TEXT,
                display_name TEXT,
                crop        TEXT,
                confidence  REAL,
                severity    TEXT,
                remedies    TEXT,
                fertilizers TEXT,
                prevention  TEXT,
                description TEXT,
                top5        TEXT,
                visual_diagnosis TEXT,
                report      TEXT
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp   TEXT NOT NULL,
                to_number   TEXT,
                message     TEXT,
                status      TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name          TEXT NOT NULL DEFAULT '',
                created_at    TEXT NOT NULL
            );
        """)
        for col, typ in {
            "prevention": "TEXT",
            "description": "TEXT",
            "visual_diagnosis": "TEXT",
            "report": "TEXT",
            "dataset_prediction": "TEXT",
            "image_data": "TEXT",
            "plant_json": "TEXT",
            "weather_json": "TEXT",
            "scan_report_json": "TEXT",
        }.items():
            try:
                cur.execute(f"ALTER TABLE predictions ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass

    con.commit()
    con.close()
    backend = "PostgreSQL" if USE_POSTGRES else "SQLite"
    print(f"[DB] {backend} database initialised.")


def save_prediction(pred: dict):
    con = _conn()
    cur = _execute(
        con,
        """
        INSERT INTO predictions
            (user_id, timestamp, filename, class_name, display_name, crop,
             confidence, severity, remedies, fertilizers, prevention, description, top5,
             visual_diagnosis, report, dataset_prediction)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        """ if USE_POSTGRES else """
        INSERT INTO predictions
            (user_id, timestamp, filename, class_name, display_name, crop,
             confidence, severity, remedies, fertilizers, prevention, description, top5,
             visual_diagnosis, report, dataset_prediction)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            pred.get("user_id", "anonymous"),
            datetime.now(timezone.utc).isoformat(),
            pred.get("filename", ""),
            pred.get("class_name", ""),
            pred.get("display_name", ""),
            pred.get("crop", ""),
            pred.get("confidence", 0.0),
            pred.get("severity", ""),
            json.dumps(pred.get("remedies", [])),
            json.dumps(pred.get("fertilizers", [])),
            pred.get("prevention", ""),
            pred.get("description", ""),
            json.dumps(pred.get("top5", [])),
            json.dumps(pred.get("visual_diagnosis", [])),
            pred.get("report", ""),
            json.dumps(pred.get("dataset_prediction") or {}),
        ),
    )
    if USE_POSTGRES:
        pred_id = _fetchone(cur)["id"]
    else:
        pred_id = cur.lastrowid
    con.commit()
    con.close()
    return pred_id


def update_prediction(pred_id: int, user_id: str, payload: dict) -> bool:
    row = get_prediction_by_id(pred_id, user_id)
    if not row:
        return False

    plant_json = json.dumps(payload.get("plant")) if payload.get("plant") is not None else None
    weather_json = json.dumps(payload.get("weather")) if payload.get("weather") is not None else None
    scan_report = {
        "cropReport": payload.get("crop_report", ""),
        "riskForecast": payload.get("risk_forecast", ""),
        "weatherLocation": payload.get("location", ""),
        "lat": payload.get("lat"),
        "lon": payload.get("lon"),
        "iotData": payload.get("iot_data"),
    }
    scan_report_json = json.dumps(scan_report)

    con = _conn()
    _execute(
        con,
        """
        UPDATE predictions SET
            image_data = COALESCE(?, image_data),
            plant_json = COALESCE(?, plant_json),
            weather_json = COALESCE(?, weather_json),
            scan_report_json = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            payload.get("image_data"),
            plant_json,
            weather_json,
            scan_report_json,
            pred_id,
            user_id,
        ),
    )
    con.commit()
    con.close()
    return True


def get_prediction_by_id(pred_id: int, user_id: str) -> dict | None:
    con = _conn()
    cur = _execute(
        con,
        "SELECT id, user_id FROM predictions WHERE id = ? AND user_id = ?",
        (pred_id, user_id),
    )
    row = _fetchone(cur)
    con.close()
    return row


def _safe_json_loads(val, default):
    if val is None or val == "":
        return default
    if isinstance(val, (dict, list)):
        return val
    try:
        parsed = json.loads(val)
        return default if parsed is None else parsed
    except (json.JSONDecodeError, TypeError):
        if isinstance(val, str) and isinstance(default, list) and val.strip():
            return [val.strip()]
        return default


def _hydrate_prediction_row(d: dict) -> dict:
    d["remedies"] = _safe_json_loads(d.get("remedies"), [])
    d["fertilizers"] = _safe_json_loads(d.get("fertilizers"), [])
    d["top5"] = _safe_json_loads(d.get("top5"), [])
    d["visual_diagnosis"] = _safe_json_loads(d.get("visual_diagnosis"), [])
    raw_ds = _safe_json_loads(d.get("dataset_prediction"), {})
    d["dataset_prediction"] = raw_ds if raw_ds else None
    d["plant_json"] = _safe_json_loads(d.get("plant_json"), None)
    d["weather_json"] = _safe_json_loads(d.get("weather_json"), None)
    d["scan_report_json"] = _safe_json_loads(d.get("scan_report_json"), None)
    return d


def get_history(limit: int = 50, user_id: str = "") -> list[dict]:
    if not user_id:
        return []
    con = _conn()
    cur = _execute(
        con,
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    )
    rows = _fetchall(cur)
    con.close()
    return [_hydrate_prediction_row(d) for d in rows]


def get_stats(user_id: str = "") -> dict:
    if not user_id:
        return {
            "total_predictions": 0,
            "crop_breakdown": [],
            "recent_predictions": [],
        }
    con = _conn()
    where = "WHERE user_id = ?"
    args = (user_id,)
    cur = _execute(con, f"SELECT COUNT(*) AS cnt FROM predictions {where}", args)
    total = _fetchone(cur)["cnt"]
    cur = _execute(
        con,
        f"SELECT crop, COUNT(*) AS cnt FROM predictions {where} GROUP BY crop ORDER BY cnt DESC",
        args,
    )
    crops = _fetchall(cur)
    cur = _execute(
        con,
        f"""
        SELECT class_name, display_name, crop, confidence, severity, timestamp
        FROM predictions {where} ORDER BY id DESC LIMIT 5
        """,
        args,
    )
    recent = _fetchall(cur)
    con.close()
    return {
        "total_predictions": total,
        "crop_breakdown": crops,
        "recent_predictions": recent,
    }
