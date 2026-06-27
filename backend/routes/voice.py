"""
Voice routes — STT, TTS, voice chat via OpenRouter.
"""

import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services.voice import (
    LANG_NAMES,
    transcribe_audio,
    synthesize_speech,
    voice_chat_reply,
    detect_language,
)

router = APIRouter(prefix="/api/voice", tags=["voice"])


class VoiceChatRequest(BaseModel):
    message: str
    language: str = "en"
    history: list[dict] = []
    context: str = ""


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class DetectLangRequest(BaseModel):
    text: str


@router.post("/detect-lang")
async def detect_lang(req: DetectLangRequest):
    """Detect ISO-639-1 language code from text (for browser-STT fallback)."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text.")
    code = detect_language(req.text)
    return {"language": code, "language_name": LANG_NAMES.get(code, code)}


@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe uploaded audio. Auto-detects language."""
    audio_bytes = await file.read()
    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio too short.")
    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio too large (max 10MB).")

    ext = (file.filename or "audio.webm").rsplit(".", 1)[-1].lower()
    result = transcribe_audio(audio_bytes, ext)

    if result.get("error") and not result.get("text"):
        raise HTTPException(status_code=502, detail=f"STT failed: {result['error']}")

    return result


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Synthesize speech in the given language. Returns MP3."""
    audio = synthesize_speech(req.text, req.language)
    if not audio:
        raise HTTPException(status_code=502, detail="TTS failed for this language.")
    return StreamingResponse(io.BytesIO(audio), media_type="audio/mpeg")


@router.post("/chat")
async def voice_chat(req: VoiceChatRequest):
    """Chat reply in the same language the farmer spoke."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message.")
    reply = voice_chat_reply(req.message, req.language, req.history, req.context)
    return {
        "reply": reply,
        "language": req.language,
        "source": "openrouter",
    }
