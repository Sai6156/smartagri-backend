"""
SQLite database for prediction history and session storage.
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "smartagri.db"


def _conn():
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = _conn()
    cur = con.cursor()
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
    }.items():
        try:
            cur.execute(f"ALTER TABLE predictions ADD COLUMN {col} {typ}")
        except sqlite3.OperationalError:
            pass
    con.commit()
    con.close()
    print("[DB] SQLite database initialised.")


def save_prediction(pred: dict):
    con = _conn()
    con.execute("""
        INSERT INTO predictions
            (user_id, timestamp, filename, class_name, display_name, crop,
             confidence, severity, remedies, fertilizers, prevention, description, top5,
             visual_diagnosis, report, dataset_prediction)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pred.get("user_id", "anonymous"),
        datetime.utcnow().isoformat(),
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
    ))
    pred_id = con.execute("SELECT last_insert_rowid()").fetchone()[0]
    con.commit()
    con.close()
    return pred_id


def get_history(limit: int = 50, user_id: str = "") -> list[dict]:
    if not user_id:
        return []
    con = _conn()
    rows = con.execute(
        "SELECT * FROM predictions WHERE user_id=? ORDER BY id DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    con.close()
    result = []
    for row in rows:
        d = dict(row)
        d["remedies"]    = json.loads(d["remedies"] or "[]")
        d["fertilizers"] = json.loads(d["fertilizers"] or "[]")
        d["top5"]        = json.loads(d["top5"] or "[]")
        d["visual_diagnosis"] = json.loads(d.get("visual_diagnosis") or "[]")
        raw_ds = json.loads(d.get("dataset_prediction") or "{}")
        d["dataset_prediction"] = raw_ds if raw_ds else None
        result.append(d)
    return result


def get_stats(user_id: str = "") -> dict:
    if not user_id:
        return {
            "total_predictions": 0,
            "crop_breakdown": [],
            "recent_predictions": [],
        }
    con = _conn()
    where = "WHERE user_id=?"
    args = (user_id,)
    total  = con.execute(f"SELECT COUNT(*) FROM predictions {where}", args).fetchone()[0]
    crops  = con.execute(
        f"SELECT crop, COUNT(*) as cnt FROM predictions {where} GROUP BY crop ORDER BY cnt DESC",
        args,
    ).fetchall()
    recent = con.execute(
        f"SELECT class_name, confidence, timestamp FROM predictions {where} ORDER BY id DESC LIMIT 5",
        args,
    ).fetchall()
    con.close()
    return {
        "total_predictions": total,
        "crop_breakdown":    [dict(r) for r in crops],
        "recent_predictions": [dict(r) for r in recent],
    }
