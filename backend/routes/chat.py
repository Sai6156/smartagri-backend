from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.llm import answer_farming_question

router = APIRouter(prefix="/api", tags=["chatbot"])

FARMING_KEYWORDS = ["disease", "blight", "rust", "mildew", "fertilizer", "irrigation",
                    "pesticide", "fungicide", "crop", "plant", "leaf", "soil", "pest",
                    "water", "spray", "organic", "harvest", "seed", "weather", "humidity",
                    "వ్యాధి", "పంట", "ఎరువు", "నీరు", "బ్లైట్",
                    "रोग", "फसल", "उर्वरक", "पानी"]

RULE_BASED = {
    "late blight":       ("Late blight (Phytophthora infestans) is highly destructive. "
                          "Apply metalaxyl + mancozeb immediately. Remove infected plants. "
                          "Avoid overhead irrigation. Monitor daily in cool, humid conditions."),
    "early blight":      ("Early blight (Alternaria solani) causes target-spot lesions. "
                          "Apply chlorothalonil or mancozeb every 7-10 days. "
                          "Remove lower infected leaves and mulch around plants."),
    "fertilizer":        ("Balanced NPK (10-10-10) works for most crops at planting. "
                          "During fruiting, switch to high-potassium (0-0-50). "
                          "Add calcium nitrate for tomatoes to prevent blossom end rot."),
    "irrigation":        ("Water at the base of plants early morning to reduce fungal risk. "
                          "Tomatoes need 1-2 inches/week. Use drip irrigation for best efficiency."),
    "pesticide":         ("For fungal diseases, use copper-based or mancozeb fungicides. "
                          "For bacterial diseases, copper hydroxide works well. "
                          "Always follow label instructions and pre-harvest intervals."),
    "powdery mildew":    ("Apply potassium bicarbonate, sulfur, or neem oil spray every 7 days. "
                          "Improve air circulation by pruning. Avoid overhead watering."),
    "neem":              ("Neem oil is effective against many pests and fungi. "
                          "Apply every 7-14 days as a preventive spray. "
                          "Mix 2ml/litre water with a few drops of dish soap."),
}


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    context: str = ""
    lang: str = "en"


@router.post("/chat")
async def chat(req: ChatRequest):
    reply = answer_farming_question(req.message, req.history, req.context, req.lang)
    if reply:
        return {"reply": reply, "source": "openrouter"}

    # Rule-based fallback
    msg = req.message.lower()
    for keyword, response in RULE_BASED.items():
        if keyword in msg:
            return {"reply": response, "source": "rule-based"}

    return {
        "reply": (
            "I'm here to help with crop diseases, fertilizers, irrigation, and pest management. "
            "Please describe your crop issue and I'll provide recommendations."
        ),
        "source": "rule-based",
    }
