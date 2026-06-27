"""
Translation + Explain routes powered by Gemma via OpenRouter.
"""

import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.services.llm import translate_text, chat_completion

router = APIRouter(prefix="/api", tags=["translate"])

SUPPORTED_LANGUAGES = {
    "en": "English", "te": "Telugu", "hi": "Hindi", "ta": "Tamil",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "bn": "Bengali",
    "gu": "Gujarati", "pa": "Punjabi", "or": "Odia", "ur": "Urdu",
    "es": "Spanish", "fr": "French", "pt": "Portuguese", "id": "Indonesian",
    "sw": "Swahili", "ar": "Arabic", "zh": "Chinese (Simplified)",
    "ja": "Japanese", "ko": "Korean", "de": "German", "it": "Italian",
    "ru": "Russian", "tr": "Turkish", "vi": "Vietnamese", "th": "Thai",
    "fil": "Filipino", "ms": "Malay", "ne": "Nepali",
}


class TranslateRequest(BaseModel):
    text:        str
    target_lang: str


class ExplainRequest(BaseModel):
    disease_name:  str
    crop:          str
    confidence:    float
    severity:      str
    description:   str
    remedies:      list[str]
    fertilizers:   list[str]
    prevention:    str
    lang:          str = "en"
    weather_info:  str = ""
    farmer_name:   str = ""


@router.get("/languages")
async def list_languages():
    return SUPPORTED_LANGUAGES


@router.post("/translate")
async def translate(req: TranslateRequest):
    if req.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400,
                            detail=f"Unsupported language: {req.target_lang}")
    if req.target_lang == "en":
        return {"translated": req.text, "lang": "en"}
    result = translate_text(req.text, req.target_lang)
    return {"translated": result, "lang": req.target_lang}


@router.post("/explain")
async def explain_disease(req: ExplainRequest):
    """
    Generate a farmer-friendly spoken explanation of the disease detection result.
    Output is plain text (no markdown) so it can be fed directly to TTS.
    Language: any supported language.
    """
    lang_name = SUPPORTED_LANGUAGES.get(req.lang, "English")
    farmer    = f"Dear {req.farmer_name}," if req.farmer_name else "Dear Farmer,"

    remedies_text    = ". ".join(req.remedies)
    fertilizers_text = ". ".join(req.fertilizers)

    prompt = f"""You are an agricultural advisor speaking directly to a farmer in simple, clear language.
Generate a warm, spoken-style explanation (no bullet points, no markdown, no asterisks, plain natural speech) in {lang_name}.
Keep it around 200 words. Be friendly and encouraging.

Start with: "{farmer}"

Detection result to explain:
- Crop: {req.crop}
- Disease: {req.disease_name}
- Confidence: {req.confidence:.0f}%
- Severity: {req.severity}
- Description: {req.description}
- Remedies: {remedies_text}
- Fertilizers: {fertilizers_text}
- Prevention: {req.prevention}
{f"- Current weather: {req.weather_info}" if req.weather_info else ""}

Explain: what disease this is, why it happens, how serious it is right now, what the farmer must do immediately, and end with encouragement.
Write entirely in {lang_name}. Use simple village-level language. No technical jargon."""

    result = chat_completion(
        [{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.6,
    )

    if not result:
        result = (
            f"{farmer} Our AI has detected {req.disease_name} on your {req.crop} crop "
            f"with {req.confidence:.0f}% confidence. Severity is {req.severity}. "
            f"Please follow these steps: {remedies_text}. {req.prevention}"
        )
        if req.lang != "en":
            result = translate_text(result, req.lang)

    return {"explanation": result, "lang": req.lang, "lang_name": lang_name}


@router.post("/tts-text")
async def tts_server_side(req: TranslateRequest):
    """
    Server-side TTS using gTTS. Returns audio bytes as mp3.
    Use this as fallback when browser Web Speech API is unavailable.
    """
    try:
        from gtts import gTTS
        tts_lang = req.target_lang.split("-")[0]  # "en-US" → "en"
        tts = gTTS(text=req.text, lang=tts_lang, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")
