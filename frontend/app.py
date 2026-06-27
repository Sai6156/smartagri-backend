"""
SmartAgri — Streamlit Frontend
Run: streamlit run frontend/app.py
"""

import requests
import streamlit as st
from PIL import Image

API_BASE = "http://localhost:8000/api"

st.set_page_config(
    page_title="SmartAgri — Crop Disease Detector",
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ── Helper functions (must be defined before if/elif chain) ───────────────

def render_weather(w: dict):
    if not w:
        return
    st.markdown(
        f"### {w.get('location','')} — {w.get('description', w.get('weather',''))} "
        f"`{w.get('source','')}`"
    )
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Temperature", f"{w.get('temperature_c', 0)}°C",
              f"Feels {w.get('feels_like_c', 0)}°C")
    c2.metric("Humidity",    f"{w.get('humidity_pct', 0)}%")
    wind_val  = w.get('wind_speed_ms', w.get('wind_speed_kph', 0))
    wind_unit = 'm/s' if 'wind_speed_ms' in w else 'kph'
    c3.metric("Wind",  f"{wind_val} {wind_unit}")
    c4.metric("Rain",  f"{w.get('rain_1h_mm', w.get('precip_mm', 0))} mm")
    st.divider()
    st.markdown(f"**Irrigation Advice:** {w.get('irrigation_advice', '')}")
    alerts = w.get("farming_alerts", [])
    if alerts:
        for a in alerts:
            st.error(a)
    else:
        st.success("No critical farming alerts for current conditions.")


def get_location() -> tuple[float, float, str]:
    try:
        loc = requests.get(f"{API_BASE}/location/detect", timeout=8).json()
        return loc["lat"], loc["lon"], loc.get("city", "")
    except Exception:
        return 17.385, 78.487, "Hyderabad"


# ── Sidebar ───────────────────────────────────────────────────────────────

with st.sidebar:
    st.image("https://img.icons8.com/color/96/plant-under-rain.png", width=80)
    st.title("SmartAgri")
    st.caption("AI-Powered Crop Disease Detection")
    st.divider()

    page = st.radio(
        "Navigation",
        [
            "🌿 Disease Detector",
            "🔬 Plant Identifier",
            "🌤 Weather Monitor",
            "📊 History & Stats",
            "📄 AI Crop Report",
            "⚠️ Risk Forecaster",
            "🤖 AI Chatbot",
        ],
        index=0,
    )

    st.divider()
    st.markdown("**Language / భాష / भाषा**")
    lang_choice = st.selectbox(
        "Language",
        ["English", "Telugu (తెలుగు)", "Hindi (हिंदी)"],
        label_visibility="collapsed",
    )
    lang = {"English": "en", "Telugu (తెలుగు)": "te", "Hindi (हिंदी)": "hi"}[lang_choice]

    st.divider()
    st.markdown("**API Status**")
    try:
        health = requests.get("http://localhost:8000/health", timeout=3).json()
        st.success("Backend: Online")
        if health.get("model_loaded"):
            st.success("AI Model: Ready (97.1% acc)")
        else:
            st.warning("AI Model: Not loaded")
    except Exception:
        st.error("Backend: Offline")
        st.code("python -m uvicorn backend.main:app --reload")

    st.divider()
    st.markdown("**Settings**")
    use_plantid = st.checkbox("Verify with Plant.id API", value=False)
    weather_src = st.selectbox("Weather Source", ["owm", "weatherapi", "both"])

    if "user_lat" not in st.session_state:
        st.session_state.user_lat = 17.385
        st.session_state.user_lon = 78.487


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 1 — Disease Detector
# ══════════════════════════════════════════════════════════════════════════
if page == "🌿 Disease Detector":
    st.title("🌿 Crop Disease Detector")
    st.markdown(
        "Upload a leaf image. Our **MobileNetV2 model** (97.1% accuracy, 38 disease classes) "
        "identifies the disease and provides treatment recommendations instantly."
    )
    st.divider()

    col1, col2 = st.columns([1, 1], gap="large")

    with col1:
        st.subheader("Upload Leaf Image")
        uploaded = st.file_uploader(
            "Choose image (JPG / PNG / WEBP)",
            type=["jpg", "jpeg", "png", "webp"],
        )
        if uploaded:
            st.image(Image.open(uploaded), caption="Uploaded Leaf", use_column_width=True)
            if st.button("Analyze Disease", type="primary", use_container_width=True):
                with st.spinner("AI is analyzing the leaf..."):
                    try:
                        uploaded.seek(0)
                        resp = requests.post(
                            f"{API_BASE}/predict",
                            files={"file": (uploaded.name, uploaded.read(), uploaded.type)},
                            params={"lang": lang, "use_plantid": use_plantid},
                            timeout=30,
                        )
                        if resp.status_code == 200:
                            st.session_state["last_prediction"] = resp.json()
                            st.success("Analysis complete!")
                        elif resp.status_code == 503:
                            st.error("Model not loaded. Place best_model.pth in backend/model/")
                        else:
                            st.error(resp.json().get("detail", "Unknown error"))
                    except requests.ConnectionError:
                        st.error("Cannot connect to backend.")

    with col2:
        st.subheader("Detection Result")
        pred = st.session_state.get("last_prediction")

        if not pred:
            st.info("Upload a leaf image and click Analyze to see results.")
        else:
            labels    = pred.get("labels", {})
            disp_name = pred.get("display_name_translated") or pred["display_name"]
            severity  = pred.get("severity_label") or pred["severity"]
            icon = {
                "High": "🔴", "Medium": "🟡", "Low": "🟢", "None": "🟢",
                "అధికం": "🔴", "మధ్యస్థం": "🟡", "उच्च": "🔴", "मध्यम": "🟡",
            }.get(severity, "⚪")

            st.markdown(f"### {icon} {disp_name}")
            if lang != "en":
                st.caption(f"({pred['display_name']})")

            c1, c2, c3 = st.columns(3)
            c1.metric(labels.get("confidence", "Confidence"), f"{pred['confidence']:.1f}%")
            c2.metric(labels.get("severity",   "Severity"),   severity)
            c3.metric(labels.get("disease",    "Crop"),       pred["crop"])
            st.progress(int(pred["confidence"]))
            st.divider()

            st.markdown(f"**Description:** {pred['description']}")
            if pred["remedies"]:
                st.markdown(f"**{labels.get('remedies', 'Remedies')}:**")
                for r in pred["remedies"]:
                    st.markdown(f"- {r}")
            if pred["fertilizers"]:
                st.markdown(f"**{labels.get('fertilizers', 'Fertilizers')}:**")
                for f in pred["fertilizers"]:
                    st.markdown(f"- {f}")
            st.markdown(
                f"**{labels.get('prevention', 'Prevention')}:** {pred['prevention']}"
            )

            with st.expander("Top 5 Predictions"):
                for i, t in enumerate(pred.get("top5", []), 1):
                    label = t["class"].replace("___", " — ")
                    st.progress(int(t["confidence"]),
                                text=f"{i}. {label} ({t['confidence']:.1f}%)")

            if use_plantid and "plantid" in pred:
                pid = pred["plantid"]
                with st.expander("Plant.id API Verification"):
                    if pid.get("available"):
                        st.write(f"Healthy: {'Yes' if pid.get('is_healthy') else 'No'}")
                        for d in pid.get("disease_suggestions", []):
                            st.markdown(f"- {d['name']} ({d['probability']:.1f}%)")
                    else:
                        st.warning(pid.get("reason", "Unavailable"))

            st.divider()
            if st.button("Generate Full AI Report", use_container_width=True):
                st.session_state["report_seed"] = pred
                st.info("Switch to **AI Crop Report** page to view the full report.")


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 2 — Plant Identifier
# ══════════════════════════════════════════════════════════════════════════
elif page == "🔬 Plant Identifier":
    st.title("🔬 Plant Species Identifier")
    st.markdown("Identify plant species from a leaf image using the **PlantNet API**.")
    st.divider()

    uploaded = st.file_uploader(
        "Upload leaf image", type=["jpg", "jpeg", "png", "webp"]
    )
    if uploaded:
        col1, col2 = st.columns(2)
        with col1:
            st.image(Image.open(uploaded), use_column_width=True)
        with col2:
            if st.button("Identify Plant Species", type="primary", use_container_width=True):
                with st.spinner("Querying PlantNet API..."):
                    try:
                        uploaded.seek(0)
                        resp = requests.post(
                            f"{API_BASE}/identify-plant",
                            files={"file": (uploaded.name, uploaded.read(), uploaded.type)},
                            timeout=30,
                        )
                        data = resp.json()
                        if not data.get("available"):
                            st.warning(f"PlantNet: {data.get('reason', 'API unavailable')}")
                        elif not data.get("found"):
                            st.warning(data.get("message", "No plant detected."))
                        else:
                            st.success(
                                f"Best match: **{data['best_match']}** "
                                f"({data['best_score']:.1f}%)"
                            )
                            if data.get("common_names"):
                                st.caption(f"Common names: {', '.join(data['common_names'])}")
                            if data.get("family"):
                                st.caption(f"Family: {data['family']}")
                            st.divider()
                            st.markdown("**All matches:**")
                            for i, r in enumerate(data.get("results", []), 1):
                                with st.container(border=True):
                                    st.markdown(
                                        f"**{i}. {r['scientific_name']}** — {r['score']:.1f}%"
                                    )
                                    if r.get("common_names"):
                                        st.caption(", ".join(r["common_names"]))
                                    st.progress(int(min(r["score"], 100)))
                            if data.get("remaining_quota") not in (None, "N/A"):
                                st.caption(
                                    f"PlantNet quota remaining: {data['remaining_quota']}"
                                )
                    except Exception as e:
                        st.error(str(e))


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 3 — Weather Monitor
# ══════════════════════════════════════════════════════════════════════════
elif page == "🌤 Weather Monitor":
    st.title("🌤 Weather Monitor")
    st.markdown("Real-time weather analysis and AI-generated farming alerts.")
    st.divider()

    col1, col2 = st.columns([1, 2])
    with col1:
        use_auto = st.checkbox("Auto-detect location", value=True)
        if use_auto:
            lat, lon, city = get_location()
            st.success(f"Detected: {city} ({lat:.2f}, {lon:.2f})")
            lat = st.number_input("Latitude",  value=lat, format="%.4f")
            lon = st.number_input("Longitude", value=lon, format="%.4f")
        else:
            lat = st.number_input("Latitude",  value=17.3850, format="%.4f")
            lon = st.number_input("Longitude", value=78.4867, format="%.4f")

        st.session_state.user_lat = lat
        st.session_state.user_lon = lon
        fetch = st.button("Get Weather", type="primary", use_container_width=True)

    if fetch:
        with st.spinner("Fetching weather..."):
            try:
                resp = requests.get(
                    f"{API_BASE}/weather",
                    params={"lat": lat, "lon": lon, "source": weather_src},
                    timeout=15,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    with col2:
                        if weather_src == "both":
                            t1, t2 = st.tabs(["OpenWeatherMap", "WeatherAPI"])
                            with t1:
                                render_weather(data.get("owm", {}))
                            with t2:
                                wa = data.get("weatherapi", {})
                                if wa.get("available"):
                                    render_weather(wa)
                                else:
                                    st.warning(wa.get("reason", "WeatherAPI unavailable"))
                        else:
                            render_weather(data)
                elif resp.status_code == 503:
                    st.error("API key not configured in .env")
                else:
                    st.error(resp.json().get("detail", "Failed"))
            except requests.ConnectionError:
                st.error("Cannot connect to backend.")

    st.divider()
    st.subheader("Forecast")
    if st.button("Load Forecast"):
        try:
            src  = weather_src if weather_src != "both" else "owm"
            resp = requests.get(
                f"{API_BASE}/weather/forecast",
                params={"lat": lat, "lon": lon, "source": src},
                timeout=15,
            )
            if resp.status_code == 200:
                import pandas as pd
                fc = resp.json()
                st.caption(
                    f"Source: {fc.get('source', '')} | "
                    f"{fc.get('city', fc.get('location', ''))}"
                )
                st.dataframe(pd.DataFrame(fc.get("forecast", [])), use_container_width=True)
        except Exception as e:
            st.error(str(e))


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 4 — History & Stats
# ══════════════════════════════════════════════════════════════════════════
elif page == "📊 History & Stats":
    st.title("📊 Prediction History & Stats")
    st.divider()

    try:
        stats   = requests.get(f"{API_BASE}/stats",            timeout=5).json()
        history = requests.get(f"{API_BASE}/history?limit=30", timeout=5).json()

        c1, c2, c3 = st.columns(3)
        c1.metric("Total Predictions", stats["total_predictions"])
        if history:
            high = sum(1 for h in history if h.get("severity") == "High")
            c2.metric("High Severity Detections", high)
            avg_conf = sum(h.get("confidence", 0) for h in history) / len(history)
            c3.metric("Avg Confidence", f"{avg_conf:.1f}%")

        if stats.get("crop_breakdown"):
            import pandas as pd
            st.subheader("Detections by Crop")
            df_crops = pd.DataFrame(stats["crop_breakdown"])
            st.bar_chart(df_crops.set_index("crop")["cnt"])

        st.subheader("Recent Detections")
        if history:
            import pandas as pd
            df = pd.DataFrame(history)[
                ["timestamp", "crop", "display_name", "confidence", "severity"]
            ].rename(columns={
                "timestamp":    "Time",
                "crop":         "Crop",
                "display_name": "Disease",
                "confidence":   "Confidence",
                "severity":     "Severity",
            })
            df["Confidence"] = df["Confidence"].map("{:.1f}%".format)
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No predictions yet. Upload images to see history here.")
    except requests.ConnectionError:
        st.error("Cannot connect to backend.")


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 5 — AI Crop Report
# ══════════════════════════════════════════════════════════════════════════
elif page == "📄 AI Crop Report":
    st.title("📄 AI Farm Advisory Report")
    st.markdown(
        "Generate a **comprehensive AI-written farm advisory report** for any detected disease. "
        "Powered by **Google Gemma 4 31B** via OpenRouter."
    )
    st.divider()

    seed = st.session_state.get("report_seed", {})

    with st.form("report_form"):
        col1, col2 = st.columns(2)
        with col1:
            disease    = st.text_input("Disease Name",
                                       value=seed.get("display_name", "Tomato Late Blight"))
            crop       = st.text_input("Crop", value=seed.get("crop", "Tomato"))
            confidence = st.number_input(
                "Confidence %",
                value=float(seed.get("confidence", 85.0)),
                min_value=0.0, max_value=100.0,
            )
            severity_options = ["High", "Medium", "Low", "None"]
            sev_idx  = severity_options.index(seed.get("severity", "High"))
            severity = st.selectbox("Severity", severity_options, index=sev_idx)
        with col2:
            remedies = st.text_area(
                "Remedies (one per line)",
                value="\n".join(
                    seed.get("remedies", ["Apply metalaxyl + mancozeb immediately."])
                ),
            )
            fertilizers = st.text_area(
                "Fertilizers (one per line)",
                value="\n".join(
                    seed.get("fertilizers", ["Reduce nitrogen. High potassium."])
                ),
            )
            prevention = st.text_input(
                "Prevention",
                value=seed.get("prevention", "Use blight-resistant varieties."),
            )
            location = st.text_input("Location (optional)", value="")

        use_weather = st.checkbox("Include current weather context", value=True)
        submitted   = st.form_submit_button(
            "Generate AI Report", type="primary", use_container_width=True
        )

    if submitted:
        lat = st.session_state.user_lat if use_weather else 0.0
        lon = st.session_state.user_lon if use_weather else 0.0
        with st.spinner("Google Gemma is writing your report..."):
            try:
                resp = requests.post(
                    f"{API_BASE}/report/generate",
                    json={
                        "class_name":   disease.lower().replace(" ", "_"),
                        "display_name": disease,
                        "crop":         crop,
                        "confidence":   confidence,
                        "severity":     severity,
                        "remedies":     [r.strip() for r in remedies.splitlines() if r.strip()],
                        "fertilizers":  [f.strip() for f in fertilizers.splitlines() if f.strip()],
                        "prevention":   prevention,
                        "lat":          lat,
                        "lon":          lon,
                        "location":     location,
                    },
                    timeout=60,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("weather"):
                        w = data["weather"]
                        st.info(
                            f"Weather context: {w.get('temperature_c')}°C, "
                            f"Humidity {w.get('humidity_pct')}%, "
                            f"{w.get('description', '')}"
                        )
                    st.divider()
                    st.markdown(data["report"])
                    st.download_button(
                        "Download Report (.md)",
                        data=data["report"],
                        file_name=f"smartagri_report_{disease.replace(' ', '_')}.md",
                        mime="text/markdown",
                    )
                else:
                    st.error("Report generation failed.")
            except Exception as e:
                st.error(str(e))


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 6 — Risk Forecaster
# ══════════════════════════════════════════════════════════════════════════
elif page == "⚠️ Risk Forecaster":
    st.title("⚠️ Disease Risk Forecaster")
    st.markdown(
        "Predict **disease outbreak risk** for your crop based on current weather, "
        "location, and detection history. Powered by **Google Gemma 4 31B**."
    )
    st.divider()

    crops = [
        "Tomato", "Potato", "Corn", "Apple", "Grape", "Pepper",
        "Strawberry", "Cherry", "Peach", "Blueberry", "Raspberry",
        "Soybean", "Squash", "Orange",
    ]

    with st.form("risk_form"):
        col1, col2 = st.columns(2)
        with col1:
            crop     = st.selectbox("Select Crop", crops)
            location = st.text_input("Location (city/region)", value="Hyderabad, Telangana")
        with col2:
            lat = st.number_input("Latitude",  value=st.session_state.user_lat, format="%.4f")
            lon = st.number_input("Longitude", value=st.session_state.user_lon, format="%.4f")
        submitted = st.form_submit_button(
            "Forecast Disease Risk", type="primary", use_container_width=True
        )

    if submitted:
        with st.spinner("Analysing weather + history with Gemma AI..."):
            try:
                resp = requests.post(
                    f"{API_BASE}/report/risk-forecast",
                    json={"crop": crop, "lat": lat, "lon": lon, "location": location},
                    timeout=60,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("weather"):
                        w = data["weather"]
                        c1, c2, c3, c4 = st.columns(4)
                        c1.metric("Temperature", f"{w.get('temperature_c', 'N/A')}°C")
                        c2.metric("Humidity",    f"{w.get('humidity_pct', 'N/A')}%")
                        c3.metric("Rain",        f"{w.get('rain_1h_mm', 0)} mm")
                        c4.metric("Condition",   w.get("description", "N/A"))
                    if data.get("recent_diseases"):
                        st.info(
                            f"Recent detections on {crop}: "
                            f"{', '.join(data['recent_diseases'])}"
                        )
                    st.divider()
                    st.markdown(data["forecast"])
                    st.download_button(
                        "Download Risk Forecast (.md)",
                        data=data["forecast"],
                        file_name=f"risk_forecast_{crop}.md",
                        mime="text/markdown",
                    )
                else:
                    st.error("Risk forecast failed.")
            except Exception as e:
                st.error(str(e))


# ══════════════════════════════════════════════════════════════════════════
#  PAGE 7 — AI Chatbot
# ══════════════════════════════════════════════════════════════════════════
elif page == "🤖 AI Chatbot":
    st.title("🤖 SmartAgri AI Assistant")
    st.markdown(
        "Ask anything about crop diseases, fertilizers, irrigation, or farming. "
        "Powered by **Google Gemma 4 31B**. Supports English, Telugu, Hindi."
    )
    st.divider()

    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if not st.session_state.chat_history:
        st.markdown("**Quick questions:**")
        suggestions = {
            "en": [
                "How do I treat late blight on tomatoes?",
                "What fertilizer is best for potatoes?",
                "How often should I water my crops?",
            ],
            "te": [
                "టొమాటో లేట్ బ్లైట్ ని ఎలా నివారించాలి?",
                "బంగాళాదుంపకు ఏ ఎరువు మంచిది?",
                "పంటకు ఎంత తరచుగా నీరు పోయాలి?",
            ],
            "hi": [
                "टमाटर में लेट ब्लाइट का इलाज कैसे करें?",
                "आलू के लिए कौन सा उर्वरक सबसे अच्छा है?",
                "फसल को कितनी बार पानी देना चाहिए?",
            ],
        }
        cols = st.columns(3)
        for i, sug in enumerate(suggestions.get(lang, suggestions["en"])):
            if cols[i].button(sug, use_container_width=True):
                st.session_state.chat_history.append({"role": "user", "content": sug})
                st.rerun()

    user_input = st.chat_input("Ask a farming question...")
    if user_input:
        st.session_state.chat_history.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)
        with st.chat_message("assistant"):
            with st.spinner("Gemma is thinking..."):
                try:
                    resp = requests.post(
                        f"{API_BASE}/chat",
                        json={
                            "message": user_input,
                            "history": st.session_state.chat_history[-6:],
                        },
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        reply = resp.json().get("reply", "Sorry, could not process that.")
                    else:
                        reply = "Backend error. Try again."
                except Exception:
                    reply = "Backend unavailable. Make sure the server is running."
                st.markdown(reply)
                st.session_state.chat_history.append({"role": "assistant", "content": reply})

    if st.session_state.chat_history:
        if st.button("Clear conversation"):
            st.session_state.chat_history = []
            st.rerun()
