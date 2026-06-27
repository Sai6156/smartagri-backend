"""
Multilingual support — English / Telugu / Hindi
Static translations for disease output fields.
For dynamic translation, set OPENAI_API_KEY and use translate_dynamic().
"""

import os

# ── Static disease name translations ──────────────────────────────────────
DISEASE_TRANSLATIONS: dict[str, dict[str, str]] = {
    "Tomato Late Blight": {
        "te": "టొమాటో లేట్ బ్లైట్",
        "hi": "टमाटर लेट ब्लाइट",
    },
    "Tomato Early Blight": {
        "te": "టొమాటో ఎర్లీ బ్లైట్",
        "hi": "टमाटर अर्ली ब्लाइट",
    },
    "Potato Late Blight": {
        "te": "బంగాళాదుంప లేట్ బ్లైట్",
        "hi": "आलू लेट ब्लाइट",
    },
    "Potato Early Blight": {
        "te": "బంగాళాదుంప ఎర్లీ బ్లైట్",
        "hi": "आलू अर्ली ब्लाइट",
    },
    "Healthy Apple": {
        "te": "ఆరోగ్యకరమైన యాపిల్",
        "hi": "स्वस्थ सेब",
    },
    "Healthy Tomato": {
        "te": "ఆరోగ్యకరమైన టొమాటో",
        "hi": "स्वस्थ टमाटर",
    },
    "Healthy Potato": {
        "te": "ఆరోగ్యకరమైన బంగాళాదుంప",
        "hi": "स्वस्थ आलू",
    },
    "Healthy Corn": {
        "te": "ఆరోగ్యకరమైన మొక్కజొన్న",
        "hi": "स्वस्थ मक्का",
    },
    "Tomato Bacterial Spot": {
        "te": "టొమాటో బ్యాక్టీరియల్ స్పాట్",
        "hi": "टमाटर बैक्टीरियल स्पॉट",
    },
    "Corn Gray Leaf Spot": {
        "te": "మొక్కజొన్న గ్రే లీఫ్ స్పాట్",
        "hi": "मक्का ग्रे लीफ स्पॉट",
    },
    "Corn Common Rust": {
        "te": "మొక్కజొన్న కామన్ రస్ట్",
        "hi": "मक्का सामान्य रस्ट",
    },
    "Corn Northern Leaf Blight": {
        "te": "మొక్కజొన్న నార్తర్న్ లీఫ్ బ్లైట్",
        "hi": "मक्का उत्तरी पत्ती झुलसा",
    },
    "Citrus Greening (HLB)": {
        "te": "సిట్రస్ గ్రీనింగ్ వ్యాధి",
        "hi": "सिट्रस ग्रीनिंग रोग",
    },
    "Tomato Yellow Leaf Curl Virus": {
        "te": "టొమాటో పసుపు ఆకు మురి వైరస్",
        "hi": "टमाटर पीला पत्ती मरोड़ वायरस",
    },
    "Tomato Mosaic Virus": {
        "te": "టొమాటో మోజాయిక్ వైరస్",
        "hi": "टमाटर मोज़ेक वायरस",
    },
    "Grape Black Rot": {
        "te": "ద్రాక్ష నల్ల కుళ్ళు వ్యాధి",
        "hi": "अंगूर काला सड़न",
    },
    "Apple Scab": {
        "te": "యాపిల్ స్కాబ్ వ్యాధి",
        "hi": "सेब स्कैब रोग",
    },
    "Apple Black Rot": {
        "te": "యాపిల్ నల్ల కుళ్ళు",
        "hi": "सेब काला सड़न",
    },
    "Peach Bacterial Spot": {
        "te": "పీచ్ బ్యాక్టీరియల్ స్పాట్",
        "hi": "आड़ू बैक्टीरियल स्पॉट",
    },
    "Pepper Bacterial Spot": {
        "te": "మిర్చి బ్యాక్టీరియల్ స్పాట్",
        "hi": "मिर्च बैक्टीरियल स्पॉट",
    },
    "Squash Powdery Mildew": {
        "te": "స్క్వాష్ పౌడరీ మిల్డ్యూ",
        "hi": "कद्दू पाउडरी मिल्ड्यू",
    },
    "Strawberry Leaf Scorch": {
        "te": "స్ట్రాబెర్రీ లీఫ్ స్కార్చ్",
        "hi": "स्ट्रॉबेरी पत्ती झुलसा",
    },
    "Tomato Spider Mites": {
        "te": "టొమాటో స్పైడర్ మైట్స్",
        "hi": "टमाटर स्पाइडर माइट्स",
    },
    "Tomato Leaf Mold": {
        "te": "టొమాటో లీఫ్ మోల్డ్",
        "hi": "टमाटर पत्ती फफूंद",
    },
    "Tomato Septoria Leaf Spot": {
        "te": "టొమాటో సెప్టోరియా లీఫ్ స్పాట్",
        "hi": "टमाटर सेप्टोरिया पत्ती धब्बा",
    },
    "Tomato Target Spot": {
        "te": "టొమాటో టార్గెట్ స్పాట్",
        "hi": "टमाटर टार्गेट स्पॉट",
    },
}

# ── UI label translations ─────────────────────────────────────────────────
UI_LABELS: dict[str, dict[str, str]] = {
    "Disease Detected": {"te": "వ్యాధి గుర్తించబడింది", "hi": "रोग पहचाना गया"},
    "Healthy Plant":    {"te": "ఆరోగ్యకరమైన మొక్క",    "hi": "स्वस्थ पौधा"},
    "Confidence":       {"te": "విశ్వాస స్కోర్",        "hi": "विश्वास स्कोर"},
    "Severity":         {"te": "తీవ్రత",                 "hi": "गंभीरता"},
    "Remedies":         {"te": "నివారణ చర్యలు",          "hi": "उपचार"},
    "Fertilizers":      {"te": "ఎరువులు",               "hi": "उर्वरक"},
    "Prevention":       {"te": "నివారణ",                 "hi": "रोकथाम"},
    "Crop":             {"te": "పంట",                    "hi": "फसल"},
    "High":             {"te": "అధికం",                  "hi": "उच्च"},
    "Medium":           {"te": "మధ్యస్థం",               "hi": "मध्यम"},
    "Low":              {"te": "తక్కువ",                 "hi": "कम"},
    "None":             {"te": "లేదు",                   "hi": "कोई नहीं"},
    "Irrigation Advice":{"te": "నీటి సేద్యం సలహా",     "hi": "सिंचाई सलाह"},
    "Farming Alerts":   {"te": "వ్యవసాయ హెచ్చరికలు",   "hi": "कृषि अलर्ट"},
    "Weather":          {"te": "వాతావరణం",               "hi": "मौसम"},
    "Temperature":      {"te": "ఉష్ణోగ్రత",             "hi": "तापमान"},
    "Humidity":         {"te": "తేమ",                    "hi": "आर्द्रता"},
}

SUPPORTED_LANGUAGES = {
    "English": "en",
    "Telugu (తెలుగు)": "te",
    "Hindi (हिंदी)": "hi",
}


def translate_disease_name(display_name: str, lang: str) -> str:
    """Return translated disease name or original if not available."""
    if lang == "en":
        return display_name
    return DISEASE_TRANSLATIONS.get(display_name, {}).get(lang, display_name)


def translate_label(label: str, lang: str) -> str:
    """Translate a UI label."""
    if lang == "en":
        return label
    return UI_LABELS.get(label, {}).get(lang, label)


def translate_dynamic(text: str, target_lang: str) -> str:
    """
    Translate arbitrary text using OpenRouter (gemma-4-31b-it:free).
    Falls back to original text if key is not set.
    """
    if target_lang == "en":
        return text
    from backend.services.llm import translate_text
    return translate_text(text, target_lang)
