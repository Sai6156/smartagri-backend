"""
Model loader and inference service.
Loads MobileNetV2 from backend/model/best_model.pth once at startup.
"""

import json
import io
from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

MODEL_DIR   = Path(__file__).resolve().parent.parent / "model"
MODEL_PATH  = MODEL_DIR / "best_model.pth"
CLASSES_PATH = MODEL_DIR / "class_names.json"

IMG_SIZE = 224
DEVICE   = torch.device("cuda" if torch.cuda.is_available() else "cpu")

infer_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class PlantDiseasePredictor:
    def __init__(self):
        self.model: Optional[nn.Module] = None
        self.idx_to_class: dict = {}
        self.num_classes: int = 38
        self.model_loaded: bool = False
        self._load()

    def _load(self):
        if not MODEL_PATH.exists():
            print(f"[WARNING] Model not found at {MODEL_PATH}. "
                  "Run Colab training first and place best_model.pth here.")
            return
        if not CLASSES_PATH.exists():
            print(f"[WARNING] class_names.json not found at {CLASSES_PATH}.")
            return

        with open(CLASSES_PATH) as f:
            raw = json.load(f)
        self.idx_to_class = {int(k): v for k, v in raw.items()}
        self.num_classes  = len(self.idx_to_class)

        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
        self.num_classes = checkpoint.get("num_classes", self.num_classes)

        model = models.mobilenet_v2(weights=None)
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(model.last_channel, 512),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(512, self.num_classes),
        )
        model.load_state_dict(checkpoint["model_state_dict"])
        model.to(DEVICE)
        model.eval()
        self.model = model
        self.model_loaded = True
        print(f"[OK] Model loaded — {self.num_classes} classes | device={DEVICE}")

    def predict(self, image_bytes: bytes) -> dict:
        if not self.model_loaded:
            return {
                "error": "Model not loaded. Please place best_model.pth in backend/model/ first.",
                "model_ready": False,
            }
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        inp = infer_transform(img).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            out    = self.model(inp)
            probs  = torch.softmax(out, dim=1)
            conf, idx = torch.max(probs, 1)

        class_name = self.idx_to_class.get(idx.item(), "Unknown")
        top5_probs, top5_idxs = torch.topk(probs, min(5, self.num_classes))
        top5 = [
            {"class": self.idx_to_class.get(i.item(), "Unknown"), "confidence": round(p.item() * 100, 2)}
            for p, i in zip(top5_probs[0], top5_idxs[0])
        ]
        return {
            "class_name":  class_name,
            "confidence":  round(conf.item() * 100, 2),
            "top5":        top5,
            "model_ready": True,
        }


# Singleton — loaded once at import
predictor = PlantDiseasePredictor()
