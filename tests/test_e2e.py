"""
Phase 8 — End-to-End Integration Tests
Run: python tests/test_e2e.py
Requires backend to be running: uvicorn backend.main:app --reload
"""

import sys
import json
import requests
from pathlib import Path
from PIL import Image
import io

BASE_URL = "http://localhost:8000"
API      = f"{BASE_URL}/api"

PASS = "[PASS]"
FAIL = "[FAIL]"
WARN = "[WARN]"

results = []


def test(name: str, passed: bool, detail: str = ""):
    status = PASS if passed else FAIL
    msg = f"{status} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append({"name": name, "passed": passed, "detail": detail})
    return passed


def make_test_image(color=(34, 139, 34)) -> bytes:
    """Create a simple solid-color test image."""
    img = Image.new("RGB", (224, 224), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ── Test 1: Backend health ─────────────────────────────────────────────────
print("\n" + "="*55)
print("SMART AGRI — End-to-End Integration Tests")
print("="*55)
print("\n[1/6] Backend Connectivity")

try:
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    test("Backend is reachable", r.status_code == 200)
    health = r.json()
    test("Health endpoint returns JSON", "status" in health)
    model_loaded = health.get("model_loaded", False)
    if model_loaded:
        test("Model is loaded", True)
    else:
        print(f"{WARN} Model not loaded — prediction tests will be skipped")
except requests.ConnectionError:
    test("Backend is reachable", False, "Connection refused. Start backend first.")
    print("\nAborting tests — backend not running.")
    sys.exit(1)


# ── Test 2: Root endpoint ─────────────────────────────────────────────────
print("\n[2/6] Root & Docs")
r = requests.get(f"{BASE_URL}/", timeout=5)
test("Root endpoint returns 200", r.status_code == 200)
test("Root lists endpoints", "endpoints" in r.json())
r = requests.get(f"{BASE_URL}/docs", timeout=5)
test("Swagger docs accessible", r.status_code == 200)


# ── Test 3: Disease Info (no model needed) ────────────────────────────────
print("\n[3/6] Disease Info Database")
from backend.services.disease_info import get_disease_info, DISEASE_INFO

test("Disease DB has 38 entries", len(DISEASE_INFO) == 38)
info = get_disease_info("Tomato___Late_blight")
test("Tomato Late Blight info present", info["display_name"] == "Tomato Late Blight")
test("Remedies list non-empty",       len(info["remedies"]) > 0)
test("Fertilizers list non-empty",    len(info["fertilizers"]) > 0)
test("Severity is High",              info["severity"] == "High")

unknown = get_disease_info("Unknown___Disease")
test("Unknown class returns fallback", "display_name" in unknown)


# ── Test 4: Prediction endpoint ───────────────────────────────────────────
print("\n[4/6] Prediction Endpoint")
img_bytes = make_test_image()

r = requests.post(
    f"{API}/predict",
    files={"file": ("test_leaf.jpg", img_bytes, "image/jpeg")},
    timeout=30,
)

if model_loaded:
    test("Predict returns 200",         r.status_code == 200)
    if r.status_code == 200:
        pred = r.json()
        test("Has class_name",   "class_name"   in pred)
        test("Has confidence",   "confidence"   in pred)
        test("Has severity",     "severity"     in pred)
        test("Has remedies",     "remedies"     in pred)
        test("Has top5",         len(pred.get("top5", [])) == 5)
        test("Confidence 0-100", 0 <= pred["confidence"] <= 100)
else:
    test("Predict returns 503 (model not ready)", r.status_code == 503, "Expected until model is placed")

# Bad file type
r_bad = requests.post(
    f"{API}/predict",
    files={"file": ("test.txt", b"not an image", "text/plain")},
    timeout=10,
)
test("Non-image upload rejected with 400", r_bad.status_code == 400)


# ── Test 5: Weather endpoint ──────────────────────────────────────────────
print("\n[5/6] Weather Endpoint")
r = requests.get(f"{API}/weather", params={"lat": 17.385, "lon": 78.4867}, timeout=10)
if r.status_code == 200:
    w = r.json()
    test("Weather returns temperature",      "temperature_c" in w)
    test("Weather returns humidity",         "humidity_pct" in w)
    test("Weather returns irrigation advice","irrigation_advice" in w)
    test("Weather returns farming alerts",   "farming_alerts" in w)
elif r.status_code == 503:
    print(f"{WARN} Weather API key not configured — skipping weather tests")
else:
    test("Weather endpoint reachable", False, f"Status: {r.status_code}")


# ── Test 6: Chat endpoint ─────────────────────────────────────────────────
print("\n[6/6] Chat Endpoint")
r = requests.post(
    f"{API}/chat",
    json={"message": "How do I treat late blight on tomatoes?", "history": []},
    timeout=30,
)
test("Chat returns 200",        r.status_code == 200)
if r.status_code == 200:
    chat = r.json()
    test("Chat has reply field", "reply" in chat)
    test("Reply is non-empty",   len(chat.get("reply", "")) > 10)
    test("Has source field",     "source" in chat)

# History & Stats
r = requests.get(f"{API}/history", timeout=5)
test("History endpoint returns 200", r.status_code == 200)
r = requests.get(f"{API}/stats", timeout=5)
test("Stats endpoint returns 200", r.status_code == 200)


# ── Summary ───────────────────────────────────────────────────────────────
print("\n" + "="*55)
passed = sum(1 for r in results if r["passed"])
total  = len(results)
print(f"Results: {passed}/{total} tests passed")
if passed == total:
    print("ALL TESTS PASSED")
else:
    print("SOME TESTS FAILED:")
    for r in results:
        if not r["passed"]:
            print(f"  {FAIL} {r['name']} — {r['detail']}")
print("="*55)
sys.exit(0 if passed == total else 1)
