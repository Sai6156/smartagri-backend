import { reverseGeocodeFallback, searchCityFallback } from "@/lib/geocodeFallback";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("sa_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, opts: RequestInit = {}, timeoutMs = 90000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: { ...authHeader(), ...(opts.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = err.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ")
            : "Request failed";
      if (res.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("sa_token");
        localStorage.removeItem("sa_user");
        window.dispatchEvent(new CustomEvent("sa-auth-expired", { detail: message }));
      }
      throw new Error(message || "Request failed");
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out — server may be waking up. Wait 30s and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    signup: (email: string, password: string, name: string) =>
      req<{ token: string; user_id: string; name: string; email: string }>(
        "/api/auth/signup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        }
      ),
    login: (email: string, password: string) =>
      req<{ token: string; user_id: string; name: string; email: string }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      ),
    me: () => req<{ user_id: string; email: string; name: string }>("/api/auth/me"),
  },

  // ── Predict ──────────────────────────────────────────────────────────
  predict: (file: File, lang: string) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<PredictResult>(`/api/predict?lang=${lang}`, {
      method: "POST",
      body: fd,
    });
  },

  // ── Explain ──────────────────────────────────────────────────────────
  explain: (data: ExplainRequest) =>
    req<{ explanation: string; lang: string; lang_name: string }>("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  // ── Chat ──────────────────────────────────────────────────────────────
  chat: (message: string, history: ChatMsg[], context = "", lang = "en") =>
    req<{ reply: string; source: string }>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, context, lang }),
    }),

  // ── Weather ──────────────────────────────────────────────────────────
  weather: (lat: number, lon: number, location?: string) =>
    req<WeatherData>(
      `/api/weather?lat=${lat}&lon=${lon}${location ? `&location=${encodeURIComponent(location)}` : ""}`
    ),

  locationDetect: () => req<LocationData>("/api/location/detect"),

  reverseGeocode: async (lat: number, lon: number) => {
    try {
      return await req<LocationData>(`/api/location/reverse?lat=${lat}&lon=${lon}`, {}, 30000);
    } catch {
      return reverseGeocodeFallback(lat, lon);
    }
  },

  searchCity: async (q: string) => {
    try {
      return await req<
        { lat: number; lon: number; city: string; region: string; country: string; label: string }[]
      >(`/api/location/search?q=${encodeURIComponent(q)}`, {}, 25000);
    } catch {
      return searchCityFallback(q);
    }
  },

  // ── Plant ID ─────────────────────────────────────────────────────────
  identifyPlant: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<PlantIDResult>("/api/identify-plant", { method: "POST", body: fd });
  },

  // ── History / Stats ──────────────────────────────────────────────────
  history: (limit = 30) => req<HistoryEntry[]>(`/api/history?limit=${limit}`),
  stats: () => req<StatsData>("/api/stats"),

  updatePrediction: (id: number, payload: PredictionUpdatePayload) =>
    req<{ ok: boolean; id: number }>(`/api/predictions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  predictionThumbnail: async (id: number): Promise<Blob> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${BASE}/api/predictions/${id}/thumbnail`, {
        headers: authHeader(),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Thumbnail not found");
      return res.blob();
    } finally {
      clearTimeout(timer);
    }
  },

  // ── AI Report / Risk ─────────────────────────────────────────────────
  generateReport: (payload: ReportRequest) =>
    req<{ report: string; weather: WeatherData }>("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  riskForecast: (crop: string, lat: number, lon: number, location: string, iotData?: string) =>
    req<{ forecast: string; weather: WeatherData }>("/api/report/risk-forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crop,
        lat,
        lon,
        location,
        iot_data: iotData?.trim() || "",
      }),
    }),

  // ── Languages ────────────────────────────────────────────────────────
  languages: () => req<Record<string, string>>("/api/languages"),

  // ── TTS (server-side fallback) ────────────────────────────────────────
  ttsAudio: async (text: string, lang: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/api/tts-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ text, target_lang: lang }),
    });
    if (!res.ok) throw new Error("TTS failed");
    return res.blob();
  },
};

// ── Types ──────────────────────────────────────────────────────────────────
export interface VisualDiagnosis {
  disease: string;
  crop_if_visible: string;
  type: string;
  confidence: number;
  visual_reason: string;
  immediate_action: string;
}

export interface DatasetPrediction {
  class_name: string;
  display_name: string;
  display_name_translated: string;
  crop: string;
  confidence: number;
  severity: string;
  description: string;
  remedies: string[];
  fertilizers: string[];
  prevention: string;
  top5: { class: string; confidence: number }[];
}

export interface PredictResult {
  class_name: string;
  display_name: string;
  display_name_translated: string;
  crop: string;
  confidence: number;
  severity: string;
  description: string;
  remedies: string[];
  fertilizers: string[];
  prevention: string;
  top5: { class: string; confidence: number }[];
  visual_diagnosis: VisualDiagnosis[];
  dataset_prediction?: DatasetPrediction | null;
  prediction_id?: number;
  user_id: string;
}

export interface ExplainRequest {
  disease_name: string;
  crop: string;
  confidence: number;
  severity: string;
  description: string;
  remedies: string[];
  fertilizers: string[];
  prevention: string;
  lang: string;
  weather_info?: string;
  farmer_name?: string;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface WeatherData {
  location: string;
  temperature_c: number;
  feels_like_c: number;
  humidity_pct: number;
  description: string;
  wind_speed_ms: number;
  rain_1h_mm: number;
  irrigation_advice: string;
  farming_alerts: string[];
}

export interface LocationData {
  lat: number;
  lon: number;
  city: string;
  region: string;
  country: string;
}

export interface PlantIDResult {
  available: boolean;
  found: boolean;
  best_match: string;
  best_score: number;
  common_names: string[];
  family: string;
  results: { scientific_name: string; common_names: string[]; score: number }[];
}

export interface HistoryEntry {
  id: number;
  user_id: string;
  timestamp: string;
  crop: string;
  class_name: string;
  display_name: string;
  confidence: number;
  severity: string;
  remedies: string[];
  fertilizers: string[];
  prevention: string;
  description: string;
  top5: { class: string; confidence: number }[];
  visual_diagnosis: VisualDiagnosis[];
  dataset_prediction?: DatasetPrediction | null;
  report?: string;
  image_data?: string;
  has_thumbnail?: boolean;
  plant_json?: PlantIDResult | null;
  weather_json?: WeatherData | null;
  scan_report_json?: ScanReportJson | null;
}

export interface ScanReportJson {
  cropReport?: string;
  riskForecast?: string;
  weatherLocation?: string;
  lat?: number;
  lon?: number;
  iotData?: unknown;
}

export interface PredictionUpdatePayload {
  image_data?: string;
  plant?: PlantIDResult | null;
  weather?: WeatherData | null;
  crop_report?: string;
  risk_forecast?: string;
  iot_data?: unknown;
  lat?: number;
  lon?: number;
  location?: string;
}

export interface StatsData {
  total_predictions: number;
  crop_breakdown: { crop: string; cnt: number }[];
  recent_predictions: {
    class_name: string;
    display_name?: string;
    crop?: string;
    confidence: number;
    severity?: string;
    timestamp: string;
  }[];
}

export interface ReportRequest {
  class_name: string;
  display_name: string;
  crop: string;
  confidence: number;
  severity: string;
  remedies: string[];
  fertilizers: string[];
  prevention: string;
  lat?: number;
  lon?: number;
  location?: string;
  iot_data?: string;
}
