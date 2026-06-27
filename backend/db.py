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
            top5        TEXT
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT NOT NULL,
            to_number   TEXT,
            message     TEXT,
            status      TEXT
        );
    """)
    con.commit()
    con.close()
    print("[DB] SQLite database initialised.")


def save_prediction(pred: dict):
    con = _conn()
    con.execute("""
        INSERT INTO predictions
            (user_id, timestamp, filename, class_name, display_name, crop,
             confidence, severity, remedies, fertilizers, top5)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        json.dumps(pred.get("top5", [])),
    ))
    con.commit()
    con.close()


def get_history(limit: int = 50, user_id: str = "") -> list[dict]:
    con = _conn()
    if user_id:
        rows = con.execute(
            "SELECT * FROM predictions WHERE user_id=? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT * FROM predictions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    con.close()
    result = []
    for row in rows:
        d = dict(row)
        d["remedies"]    = json.loads(d["remedies"] or "[]")
        d["fertilizers"] = json.loads(d["fertilizers"] or "[]")
        d["top5"]        = json.loads(d["top5"] or "[]")
        result.append(d)
    return result


def get_stats(user_id: str = "") -> dict:
    con   = _conn()
    where = "WHERE user_id=?" if user_id else ""
    args  = (user_id,) if user_id else ()
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
