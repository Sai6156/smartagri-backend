# SmartAgri — AI Crop Disease Detection System

## Quick Start

```bash
# Terminal 1 — Backend
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
streamlit run frontend/app.py
```

## API Keys (already injected in .env)
| Key | Service | Status |
|-----|---------|--------|
| `OPENROUTER_API_KEY` | Gemma 4 31B — Chatbot, Translation, Reports | Working |
| `PLANTNET_API_KEY` | PlantNet — Plant species identification | Working |
| `OPENWEATHER_API_KEY` | Weather alerts + irrigation advice | Needs renewal |

## Frontend Pages
| Page | Feature |
|------|---------|
| Disease Detector | Upload leaf → AI predicts disease (97.1% acc) |
| Plant Identifier | PlantNet API — identify plant species |
| Weather Monitor | Real-time weather + farming alerts |
| History & Stats | Prediction dashboard + crop breakdown charts |
| AI Crop Report | Gemma writes full farm advisory report |
| Risk Forecaster | Gemma predicts disease outbreak risk from weather |
| AI Chatbot | Farming Q&A in English / Telugu / Hindi |

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict?lang=en\|te\|hi` | Leaf image → disease + remedies |
| POST | `/api/identify-plant` | PlantNet species identification |
| GET | `/api/weather?lat=&lon=&source=owm\|weatherapi\|both` | Weather + farming alerts |
| GET | `/api/weather/forecast` | 5-day forecast |
| GET | `/api/location/detect` | Auto-detect location via IP |
| POST | `/api/report/generate` | AI full advisory report (Gemma) |
| POST | `/api/report/risk-forecast` | Disease outbreak risk prediction (Gemma) |
| POST | `/api/chat` | Farming chatbot (Gemma) |
| GET | `/api/history` | Prediction history |
| GET | `/api/stats` | Dashboard statistics |

## Project Structure
```
.
├── backend/
│   ├── main.py
│   ├── db.py
│   ├── model/
│   │   ├── best_model.pth       # MobileNetV2 trained model (97.1% acc)
│   │   └── class_names.json
│   ├── routes/
│   │   ├── predict.py           # Disease detection
│   │   ├── weather.py           # OpenWeatherMap + WeatherAPI
│   │   ├── chat.py              # AI chatbot
│   │   ├── history.py           # Prediction history
│   │   └── report.py            # AI reports + risk forecaster
│   └── services/
│       ├── predictor.py         # MobileNetV2 inference
│       ├── disease_info.py      # 38-class remedy database
│       ├── llm.py               # OpenRouter/Gemma gateway
│       ├── plantnet_api.py      # PlantNet species ID
│       ├── plantid_api.py       # Plant.id disease API
│       ├── weather_api.py       # WeatherAPI.com
│       ├── location.py          # IP-based GPS detection
│       └── translator.py        # EN/Telugu/Hindi translation
├── frontend/
│   └── app.py                   # Streamlit 7-page UI
├── notebooks/
│   ├── SmartAgri_Train_Colab.ipynb
│   ├── phase2_preprocess.py
│   └── outputs/                 # Training curves, confusion matrix
├── tests/
│   └── test_e2e.py              # 26/26 integration tests passing
├── .env                         # API keys (do not commit)
└── render.yaml                  # Render.com deployment
```
