"""
SmartAgri FastAPI Backend
Run: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""

from pathlib import Path
from dotenv import load_dotenv

# Load .env — try multiple locations to be robust
root = Path(__file__).resolve().parent.parent
for _env_name in [".env", "secrets.env"]:
    _env_path = root / _env_name
    if _env_path.exists():
        load_dotenv(_env_path, override=True)
        print(f"[ENV] Loaded: {_env_path}")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import init_db
from backend.routes.predict   import router as predict_router
from backend.routes.weather   import router as weather_router
from backend.routes.chat      import router as chat_router
from backend.routes.history   import router as history_router
from backend.routes.report    import router as report_router
from backend.routes.auth      import router as auth_router
from backend.routes.translate import router as translate_router
from backend.routes.voice     import router as voice_router

app = FastAPI(
    title="SmartAgri API",
    description="AI-powered crop disease detection and smart agriculture monitoring.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vercel frontend + localhost
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


app.include_router(auth_router)
app.include_router(predict_router)
app.include_router(weather_router)
app.include_router(chat_router)
app.include_router(history_router)
app.include_router(report_router)
app.include_router(translate_router)
app.include_router(voice_router)


@app.get("/")
async def root():
    return {
        "service": "SmartAgri API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": [
            "POST /api/predict?lang=en|te|hi&use_plantid=false",
            "POST /api/identify-plant",
            "GET  /api/weather?lat=&lon=&source=owm|weatherapi|both",
            "GET  /api/weather/forecast?lat=&lon=&source=owm|weatherapi",
            "GET  /api/location/detect",
            "POST /api/chat",
            "POST /api/report/generate",
            "POST /api/report/risk-forecast",
            "GET  /api/history",
            "GET  /api/stats",
            "GET  /api/model-status",
        ],
    }


@app.get("/health")
async def health():
    from backend.services.predictor import predictor
    return {"status": "ok", "model_loaded": predictor.model_loaded}
