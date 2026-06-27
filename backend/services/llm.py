"""
OpenRouter LLM service — central gateway for all AI generation.
Default model: google/gemma-4-31b-it:free
Falls back to rule-based responses when key is missing.
"""

import os
import requests
from typing import Optional

OPENROUTER_BASE  = "https://openrouter.ai/api/v1"
DEFAULT_MODEL    = "google/gemma-4-31b-it:free"
FAST_MODEL       = "google/gemma-4-31b-it:free"   # same — free tier is fast enough


def _strip_markdown(text: str) -> str:
    """Plain text for display and TTS — no asterisks read aloud."""
    import re
    if not text:
        return ""
    t = text
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"__([^_]+)__", r"\1", t)
    t = re.sub(r"_([^_]+)_", r"\1", t)
    t = re.sub(r"#{1,6}\s+", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"^[-*•]\s+", "", t, flags=re.MULTILINE)
    return t.strip()


def _headers() -> dict:
    key = os.getenv("OPENROUTER_API_KEY", "")
    return {
        "Authorization":  f"Bearer {key}",
        "Content-Type":   "application/json",
        "HTTP-Referer":   "https://smartagri.app",
        "X-Title":        "SmartAgri Disease Detection",
    }


def chat_completion(
    messages: list[dict],
    model: str = DEFAULT_MODEL,
    max_tokens: int = 600,
    temperature: float = 0.7,
) -> Optional[str]:
    """
    Call OpenRouter chat completion. Returns text or None on failure.
    """
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key:
        return None

    payload = {
        "model":       model,
        "messages":    messages,
        "max_tokens":  max_tokens,
        "temperature": temperature,
    }
    try:
        resp = requests.post(
            f"{OPENROUTER_BASE}/chat/completions",
            json=payload,
            headers=_headers(),
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"].strip()
        return None
    except Exception:
        return None


def translate_text(text: str, target_lang: str) -> str:
    """Translate text to Telugu or Hindi using OpenRouter."""
    if target_lang == "en" or not text.strip():
        return text

    lang_names = {"te": "Telugu", "hi": "Hindi"}
    lang_name  = lang_names.get(target_lang, "English")

    messages = [
        {
            "role": "system",
            "content": (
                f"You are an agricultural translator. Translate the following text to {lang_name}. "
                "Keep technical terms (pesticide names, chemical names like mancozeb, chlorothalonil) in English. "
                "Keep numbers and percentages as-is. Return ONLY the translated text, nothing else."
            ),
        },
        {"role": "user", "content": text},
    ]
    result = chat_completion(messages, max_tokens=400, temperature=0.1)
    return result if result else text


def generate_crop_report(
    disease_name: str,
    crop: str,
    confidence: float,
    severity: str,
    remedies: list[str],
    fertilizers: list[str],
    prevention: str,
    weather: Optional[dict] = None,
    location: str = "",
) -> str:
    """
    Generate a comprehensive farm advisory report using LLM.
    """
    weather_context = ""
    if weather:
        weather_context = (
            f"Current weather: {weather.get('temperature_c', 'N/A')}°C, "
            f"Humidity {weather.get('humidity_pct', 'N/A')}%, "
            f"{weather.get('description', weather.get('weather', ''))}."
        )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert agricultural scientist and farm advisor. "
                "Write a professional, detailed farm advisory report based on a disease detection result. "
                "Use PLAIN TEXT ONLY — no markdown, no asterisks, no hash symbols, no bullet dashes. "
                "Put each section title on its own line in ALL CAPS, then a blank line, then the section body. "
                "Be specific, practical, and include timelines for treatments."
            ),
        },
        {
            "role": "user",
            "content": f"""Write a comprehensive farm advisory report for the following detection:

Disease Detected: {disease_name}
Crop: {crop}
AI Confidence: {confidence:.1f}%
Severity: {severity}
Location: {location or 'Not specified'}
{weather_context}

Known Remedies: {'; '.join(remedies)}
Recommended Fertilizers: {'; '.join(fertilizers)}
Prevention: {prevention}

Include these sections (title in ALL CAPS, plain text only):
EXECUTIVE SUMMARY
DISEASE OVERVIEW
IMMEDIATE ACTION PLAN
TREATMENT SCHEDULE
FERTILIZER AND NUTRITION PLAN
WEATHER-BASED RISK ASSESSMENT
LONG-TERM PREVENTION STRATEGY
WHEN TO CONSULT AN EXPERT

Make it actionable for a farmer. Use simple language. No markdown formatting.""",
        },
    ]
    result = chat_completion(messages, max_tokens=1200, temperature=0.5)
    return result or _fallback_report(disease_name, crop, severity, remedies)


def generate_risk_forecast(
    crop: str,
    location: str,
    weather: dict,
    recent_diseases: list[str],
) -> str:
    """
    Predict disease outbreak risk based on weather + crop + history using LLM.
    """
    temp     = weather.get("temperature_c", "N/A")
    humidity = weather.get("humidity_pct", "N/A")
    rain     = weather.get("rain_1h_mm", weather.get("precip_mm", 0))
    desc     = weather.get("description", weather.get("weather", "Unknown"))

    recent_str = ", ".join(recent_diseases) if recent_diseases else "None reported"

    messages = [
        {
            "role": "system",
            "content": (
                "You are a plant pathology expert specializing in disease outbreak prediction. "
                "Analyze weather conditions and crop history to forecast disease risk. "
                "Be specific about which diseases are most likely and why. "
                "Use a risk level scale: LOW / MODERATE / HIGH / CRITICAL."
            ),
        },
        {
            "role": "user",
            "content": f"""Forecast disease outbreak risk for:

**Crop:** {crop}
**Location:** {location or 'India (general)'}
**Current Weather:** {temp}°C, Humidity {humidity}%, Rain {rain}mm, {desc}
**Recently Detected Diseases:** {recent_str}

Provide:
1. Overall Risk Level (LOW/MODERATE/HIGH/CRITICAL)
2. Top 3 Most Likely Diseases to Outbreak (with reasoning)
3. Weather Risk Factors Explained
4. Preventive Spray Schedule for Next 2 Weeks
5. Monitoring Checklist (what to look for daily)
6. Emergency Response if Outbreak Starts

Format with markdown headers. Be specific to the crop and weather conditions.""",
        },
    ]
    result = chat_completion(messages, max_tokens=900, temperature=0.4)
    return result or _fallback_risk(crop, humidity, temp)


def answer_farming_question(
    question: str,
    history: list[dict],
    context: str = "",
    lang: str = "en",
) -> str:
    """Answer a farming question using OpenRouter."""
    system_prompt = (
        "You are SmartAgri Assistant, an expert agricultural advisor with deep knowledge of:\n"
        "- Crop disease identification, treatment, and prevention\n"
        "- Fertilizer recommendations and soil nutrition\n"
        "- Irrigation and water management\n"
        "- Pest management (integrated pest management)\n"
        "- Weather impact on crop health\n"
        "- Organic and conventional farming practices\n\n"
        "Give practical, actionable advice in 3-5 sentences unless detailed explanation is needed. "
        "Mention scientific names when relevant. Recommend safe pesticide handling practices.\n"
        "IMPORTANT: Use plain text only. No markdown, no asterisks, no bullet points, no bold.\n"
    )
    if context.strip():
        system_prompt += (
            "\nThe farmer already analyzed their leaf. Use this scan data as ground truth. "
            "Do NOT ask them to upload, attach, or describe a photo — they already did.\n"
            f"{context.strip()}\n"
        )
    if lang and lang != "en":
        system_prompt += f"\nReply in the user's language (code: {lang}).\n"

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-6:])
    messages.append({"role": "user", "content": question})

    result = chat_completion(messages, max_tokens=500, temperature=0.7)
    return _strip_markdown(result or "")


def visual_disease_possibilities(
    image_bytes: bytes,
    filename: str = "leaf.jpg",
    model_prediction: str = "",
) -> list[dict]:
    """Use Gemma as a visual second opinion independent of dataset classes."""
    import base64
    import json

    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key or not image_bytes:
        return []

    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    mime = "image/png" if ext == "png" else "image/webp" if ext == "webp" else "image/jpeg"
    data_url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode('ascii')}"

    prompt = f"""You are a plant pathologist. Inspect this uploaded leaf image directly.
The dataset classifier predicted: {model_prediction or 'unknown'}.
Do not be limited to the dataset classes. List the top 4 visually plausible crop disease possibilities.
For each item include: disease, crop_if_visible, type (fungal/bacterial/viral/pest/nutrient/environmental), confidence 0-100, visual_reason, immediate_action.
If the image resembles grape downy mildew, explicitly include Downy Mildew.
Return ONLY valid JSON as an array of 4 objects. No markdown."""

    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "max_tokens": 900,
        "temperature": 0.2,
    }

    try:
        resp = requests.post(
            f"{OPENROUTER_BASE}/chat/completions",
            json=payload,
            headers=_headers(),
            timeout=45,
        )
        if resp.status_code != 200:
            return []
        text = resp.json()["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
        data = json.loads(text)
        if not isinstance(data, list):
            return []

        cleaned = []
        for item in data[:4]:
            if not isinstance(item, dict):
                continue
            cleaned.append(
                {
                    "disease": str(item.get("disease", "Unknown")),
                    "crop_if_visible": str(item.get("crop_if_visible", "Unknown")),
                    "type": str(item.get("type", "Unknown")),
                    "confidence": float(item.get("confidence", 0) or 0),
                    "visual_reason": str(item.get("visual_reason", "")),
                    "immediate_action": str(item.get("immediate_action", "")),
                }
            )
        return cleaned
    except Exception:
        return []


# ── Fallbacks ─────────────────────────────────────────────────────────────
def _fallback_report(disease: str, crop: str, severity: str, remedies: list[str]) -> str:
    return (
        f"## Farm Advisory Report\n\n"
        f"**Disease:** {disease} | **Crop:** {crop} | **Severity:** {severity}\n\n"
        f"### Immediate Actions\n" +
        "\n".join(f"- {r}" for r in remedies) +
        "\n\n### Note\nFor a detailed AI-generated report, configure your OPENROUTER_API_KEY."
    )


def _fallback_risk(crop: str, humidity, temp) -> str:
    risk = "HIGH" if float(humidity or 50) > 80 else "MODERATE"
    return (
        f"## Disease Risk Forecast\n\n"
        f"**Crop:** {crop} | **Risk Level:** {risk}\n\n"
        f"Current humidity ({humidity}%) and temperature ({temp}°C) suggest "
        f"{'elevated fungal disease risk.' if risk == 'HIGH' else 'moderate disease pressure.'}\n\n"
        "For a detailed AI forecast, configure your OPENROUTER_API_KEY."
    )
