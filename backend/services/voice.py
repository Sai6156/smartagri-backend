"""
Voice pipeline via OpenRouter:
- STT:  /api/v1/audio/transcriptions  (Whisper)
- TTS:  /api/v1/audio/speech
- Chat: Gemma with reply-in-same-language instruction
"""

import base64
import json
import os
import re
from typing import Optional

import requests

from backend.services.llm import OPENROUTER_BASE, DEFAULT_MODEL, _headers, chat_completion

STT_MODEL = "openai/whisper-1"
TTS_MODEL = os.getenv("OPENROUTER_TTS_MODEL", "sesame/csm-1b")

LANG_NAMES: dict[str, str] = {
    "en": "English", "te": "Telugu", "hi": "Hindi", "ta": "Tamil",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali",
    "gu": "Gujarati", "pa": "Punjabi", "or": "Odia", "ur": "Urdu",
    "es": "Spanish", "fr": "French", "pt": "Portuguese", "id": "Indonesian",
    "sw": "Swahili", "ar": "Arabic", "zh": "Chinese", "ja": "Japanese",
    "ko": "Korean", "de": "German", "it": "Italian", "ru": "Russian",
    "tr": "Turkish", "vi": "Vietnamese", "th": "Thai", "fil": "Filipino",
    "ms": "Malay", "ne": "Nepali",
}

# ISO-639-1 → OpenAI TTS voice (multilingual via instructions)
TTS_VOICES = {
    "en": "alloy", "es": "nova", "fr": "shimmer", "de": "echo",
    "it": "fable", "pt": "onyx", "ja": "nova", "ko": "shimmer",
    "zh": "alloy", "ar": "onyx", "hi": "nova", "te": "nova",
    "ta": "nova", "bn": "nova", "mr": "nova", "default": "alloy",
}


def _api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "")


def transcribe_audio(audio_bytes: bytes, audio_format: str = "webm") -> dict:
    """
    Transcribe audio using OpenRouter Whisper.
    Returns { text, language, language_name }.
    language is auto-detected by Whisper when possible.
    """
    key = _api_key()
    if not key:
        return {"text": "", "language": "en", "language_name": "English", "error": "No API key"}

    fmt = audio_format.lower().replace("audio/", "").split(";")[0]
    if fmt not in ("wav", "mp3", "webm", "ogg", "m4a", "flac", "aac"):
        fmt = "webm"

    payload = {
        "model": STT_MODEL,
        "input_audio": {
            "data": base64.b64encode(audio_bytes).decode("ascii"),
            "format": fmt,
        },
    }

    try:
        resp = requests.post(
            f"{OPENROUTER_BASE}/audio/transcriptions",
            json=payload,
            headers=_headers(),
            timeout=60,
        )
        if resp.status_code != 200:
            err = resp.text[:300]
            if resp.status_code == 402 or "balance" in err.lower():
                return {
                    "text": "",
                    "language": "en",
                    "language_name": "English",
                    "error": "OpenRouter audio requires at least $0.50 account balance for speech-to-text.",
                }
            return {
                "text": "",
                "language": "en",
                "language_name": "English",
                "error": err,
            }
        data = resp.json()
        text = (data.get("text") or "").strip()
        lang = (data.get("language") or _detect_lang_from_text(text) or "en").lower()[:2]
        return {
            "text": text,
            "language": lang,
            "language_name": LANG_NAMES.get(lang, lang),
        }
    except Exception as e:
        return {"text": "", "language": "en", "language_name": "English", "error": str(e)}


def _detect_lang_from_text(text: str) -> Optional[str]:
    if not text.strip():
        return None
    result = chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "Detect the language of the user's message. "
                    "Reply with ONLY the ISO 639-1 two-letter code (e.g. en, te, hi, ta, es). Nothing else."
                ),
            },
            {"role": "user", "content": text},
        ],
        max_tokens=10,
        temperature=0.0,
    )
    if not result:
        return None
    code = re.sub(r"[^a-z]", "", result.lower())[:2]
    return code if len(code) == 2 else None


def synthesize_speech(text: str, lang: str = "en") -> Optional[bytes]:
    """Generate speech audio via OpenRouter TTS. Returns MP3 bytes."""
    key = _api_key()
    if not key or not text.strip():
        return None

    lang = (lang or "en").lower()[:2]
    voice = TTS_VOICES.get(lang, TTS_VOICES["default"])

    payload = {
        "model": TTS_MODEL,
        "input": text,
        "voice": voice,
        "response_format": "mp3",
    }

    try:
        resp = requests.post(
            f"{OPENROUTER_BASE}/audio/speech",
            json=payload,
            headers=_headers(),
            timeout=90,
        )
        if resp.status_code == 200 and resp.content:
            return resp.content
        return None
    except Exception:
        return None


def detect_language(text: str) -> str:
    """Return ISO-639-1 code for spoken text."""
    return _detect_lang_from_text(text) or "en"


def voice_chat_reply(
    message: str,
    lang: str,
    history: list[dict],
    context: str = "",
) -> str:
    """Answer in the same language the farmer spoke."""
    lang_name = LANG_NAMES.get(lang, lang)

    system = (
        "You are SmartAgri Assistant, an expert agricultural advisor.\n"
        f"CRITICAL: The farmer is speaking in {lang_name} (code: {lang}). "
        f"You MUST reply entirely in {lang_name}. Do not use English unless the farmer spoke English.\n"
        "Give practical, actionable advice in 2-4 short sentences suitable for text-to-speech. "
        "No markdown, no bullet points, plain spoken language.\n"
    )
    if context:
        system += f"\nContext from their crop scan:\n{context}\n"

    messages = [{"role": "system", "content": system}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": message})

    result = chat_completion(messages, model=DEFAULT_MODEL, max_tokens=400, temperature=0.6)
    return result or _fallback_reply(lang_name)


def _fallback_reply(lang_name: str) -> str:
    fallbacks = {
        "Telugu": "క్షమించండి, ప్రశ్నను అర్థం చేసుకోలేకపోయాను. మళ్ళీ ప్రయత్నించండి.",
        "Hindi": "माफ़ करें, मैं समझ नहीं पाया। कृपया फिर से पूछें।",
        "Tamil": "மன்னிக்கவும், புரியவில்லை. மீண்டும் கேளுங்கள்.",
    }
    return fallbacks.get(lang_name, "Sorry, I could not process that. Please try again.")
