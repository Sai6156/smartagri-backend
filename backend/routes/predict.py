from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Header
from backend.services.predictor import predictor
from backend.services.disease_info import get_disease_info
from backend.services.plantid_api import identify_disease
from backend.services.plantnet_api import identify_plant as plantnet_identify
from backend.services.translator import translate_disease_name, translate_label, translate_dynamic
from backend.db import save_prediction

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict")
async def predict_disease(
    file: UploadFile = File(...),
    lang: str = Query(default="en"),
    use_plantid: bool = Query(default=False),
    authorization: str = Header(default=""),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    user_id = "anonymous"
    if authorization.startswith("Bearer "):
        try:
            from backend.routes.auth import decode_token
            payload = decode_token(authorization.split(" ", 1)[1])
            user_id = payload.get("user_id", "anonymous")
        except Exception:
            pass

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    # Primary: our trained model
    result = predictor.predict(image_bytes)
    if not result.get("model_ready"):
        raise HTTPException(status_code=503, detail=result.get("error", "Model not ready."))

    class_name = result["class_name"]
    info       = get_disease_info(class_name)

    # Translate output if requested
    translated_name = translate_disease_name(info["display_name"], lang)
    remedies        = info["remedies"]
    fertilizers     = info["fertilizers"]
    prevention      = info["prevention"]
    description     = info["description"]

    if lang != "en":
        remedies    = [translate_dynamic(r, lang) for r in remedies]
        fertilizers = [translate_dynamic(f, lang) for f in fertilizers]
        prevention  = translate_dynamic(prevention, lang)
        description = translate_dynamic(description, lang)

    prediction = {
        "class_name":     class_name,
        "display_name":   info["display_name"],
        "display_name_translated": translated_name,
        "crop":           info["crop"],
        "confidence":     result["confidence"],
        "severity":       info["severity"],
        "severity_label": translate_label(info["severity"], lang),
        "description":    description,
        "remedies":       remedies,
        "fertilizers":    fertilizers,
        "prevention":     prevention,
        "top5":           result["top5"],
        "filename":       file.filename,
        "user_id":        user_id,
        "language":       lang,
        "labels": {
            "disease":    translate_label("Disease Detected", lang),
            "confidence": translate_label("Confidence", lang),
            "severity":   translate_label("Severity", lang),
            "remedies":   translate_label("Remedies", lang),
            "fertilizers":translate_label("Fertilizers", lang),
            "prevention": translate_label("Prevention", lang),
        }
    }

    # Secondary: Plant.id API (optional, async-style — non-blocking on failure)
    if use_plantid:
        plantid_result = identify_disease(image_bytes)
        prediction["plantid"] = plantid_result

    save_prediction(prediction)
    return prediction


@router.post("/identify-plant")
async def identify_plant_species(file: UploadFile = File(...)):
    """Use PlantNet API to identify plant species from a leaf image."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    image_bytes = await file.read()
    return plantnet_identify(image_bytes, file.filename or "leaf.jpg")


@router.get("/model-status")
async def model_status():
    return {
        "model_loaded": predictor.model_loaded,
        "num_classes":  predictor.num_classes,
    }
