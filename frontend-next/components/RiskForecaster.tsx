"use client";
import { useEffect, useState } from "react";
import { api, PredictResult } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import { AlertTriangle, Loader2, Volume2 } from "lucide-react";

const CROPS = ["Tomato", "Potato", "Pepper", "Corn", "Wheat", "Rice", "Apple", "Grape", "Strawberry", "Soybean"];

interface Props { lang: string; speechLang: string; }

function loadLastScan(): { result: PredictResult; imageUrl?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sa_last_scan");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function RiskForecaster({ lang: _lang, speechLang }: Props) {
  const [crop, setCrop] = useState("Tomato");
  const [location, setLocation] = useState("");
  const [forecast, setForecast] = useState("");
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<{ result: PredictResult; imageUrl?: string } | null>(null);
  const tts = new TTSPlayer();

  useEffect(() => {
    const refresh = () => {
      const latest = loadLastScan();
      setScan(latest);
      if (latest?.result?.crop) setCrop(latest.result.crop);
    };
    refresh();
    window.addEventListener("sa-last-scan-updated", refresh);
    return () => window.removeEventListener("sa-last-scan-updated", refresh);
  }, []);

  async function generate() {
    setLoading(true); setForecast("");
    try {
      const loc = await api.locationDetect().catch(() => ({ lat: 17.38, lon: 78.46, city: location || "Local", region: "", country: "" }));
      const res = await api.riskForecast(crop, loc.lat, loc.lon, location || loc.city);
      const context = scan?.result
        ? `Latest leaf scan context: dataset model predicted ${scan.result.display_name} (${scan.result.confidence.toFixed(1)}%). Gemma visual top possibility: ${scan.result.visual_diagnosis?.[0]?.disease || "not available"}.\n\n`
        : "";
      setForecast(context + res.forecast);
    } catch (e: unknown) {
      setForecast("Forecast failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card">
        <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400" /> Disease Risk Forecaster
        </h2>
        <p className="text-gray-500 text-sm mb-4">Uses current weather plus your latest leaf scan context automatically.</p>

        {scan?.result && (
          <div className="bg-gray-800 rounded-xl p-3 mb-4 flex gap-3 items-center">
            {scan.imageUrl && <img src={scan.imageUrl} alt="latest scan" className="w-20 h-16 object-cover rounded-lg" />}
            <div>
              <p className="text-xs text-green-400 uppercase tracking-wide font-semibold">Latest scan connected</p>
              <p className="text-sm text-white">{scan.result.display_name}</p>
              <p className="text-xs text-gray-500">{scan.result.crop} · {scan.result.confidence.toFixed(1)}%</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Crop</label>
            <select className="input" value={crop} onChange={(e) => setCrop(e.target.value)}>
              {[...new Set([crop, ...CROPS])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Location (optional)</label>
            <input className="input" placeholder="e.g. Hyderabad, Telangana"
              value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <button onClick={generate} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Analyzing risk..." : "Forecast Risk From Scan + Weather"}
          </button>
        </div>
      </div>

      {forecast && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Risk Analysis for {crop}</h3>
            <button onClick={() => tts.speak(forecast, speechLang)} className="btn-secondary text-xs flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" /> Listen
            </button>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {forecast}
          </div>
        </div>
      )}
    </div>
  );
}
