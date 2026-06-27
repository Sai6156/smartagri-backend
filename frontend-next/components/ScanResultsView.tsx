"use client";
import { ScanLog } from "@/lib/scanLog";
import CropReportDownload from "@/components/CropReportDownload";
import { stripReportMarkdown } from "@/lib/formatReport";
import {
  Microscope, Cloud, AlertTriangle,
  Thermometer, Droplets, Wind, Sparkles,
} from "lucide-react";

const SEV_BADGE: Record<string, string> = {
  High: "badge-high", Medium: "badge-medium", Low: "badge-low", None: "badge-none",
};

interface Props {
  log: ScanLog;
  isArchive?: boolean;
}

export default function ScanResultsView({ log, isArchive }: Props) {
  const p = log.prediction;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {isArchive && (
        <div className="text-center text-xs text-gray-500">
          Archived scan · {new Date(log.timestamp).toLocaleString()}
        </div>
      )}

      <CropReportDownload log={log} />

      {/* Hero */}
      <div className="card card-glow overflow-hidden">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="rounded-xl overflow-hidden bg-gray-900 border border-white/5">
            <img src={log.imageUrl} alt="Leaf scan" className="w-full max-h-72 object-contain" />
          </div>
          <div>
            <p className="text-xs text-green-400 uppercase tracking-widest font-semibold mb-1">Disease Detection</p>
            <h2 className="text-2xl font-bold text-white font-serif">{p.display_name_translated || p.display_name}</h2>
            <p className="text-gray-400 mt-1">{p.crop}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-green-400 font-bold text-lg">{p.confidence.toFixed(1)}%</span>
              <span className={`badge ${SEV_BADGE[p.severity] || "badge-none"}`}>{p.severity}</span>
            </div>
            <p className="text-gray-300 text-sm mt-4 leading-relaxed">{p.description}</p>
          </div>
        </div>
      </div>

      {/* Visual AI */}
      {p.visual_diagnosis?.length > 0 && (
        <section className="card border-blue-900/40">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-blue-400" /> AI Visual Second Opinion
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {p.visual_diagnosis.slice(0, 4).map((v, i) => (
              <div key={i} className="bg-gray-900/80 rounded-xl p-3 border border-blue-900/30">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium text-white">{v.disease}</p>
                  <span className="text-xs text-blue-300">{v.confidence.toFixed(0)}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{v.crop_if_visible}</p>
                <p className="text-xs text-gray-400 mt-2">{v.visual_reason}</p>
                {v.immediate_action && (
                  <p className="text-xs text-green-300 mt-2">{v.immediate_action}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Remedies row */}
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">Remedies</h3>
          <ul className="space-y-1.5">
            {p.remedies.map((r, i) => (
              <li key={i} className="text-sm text-gray-400 flex gap-2">
                <span className="text-green-500">•</span> {r}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">Fertilizers</h3>
          <ul className="space-y-1.5">
            {p.fertilizers.map((f, i) => (
              <li key={i} className="text-sm text-gray-400 flex gap-2">
                <span className="text-green-500">•</span> {f}
              </li>
            ))}
          </ul>
          {p.prevention && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs font-semibold text-green-400 mb-1">Prevention</p>
              <p className="text-sm text-gray-400">{p.prevention}</p>
            </div>
          )}
        </section>
      </div>

      {/* Plant ID */}
      {log.plant && (
        <section className="card">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
            <Microscope className="w-4 h-4 text-emerald-400" /> Plant Identifier
          </h3>
          {log.plant.found ? (
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-lg font-medium text-white">{log.plant.best_match}</p>
              <p className="text-sm text-gray-400 mt-1">
                {log.plant.common_names?.slice(0, 3).join(", ")} · {log.plant.family}
              </p>
              <p className="text-green-400 text-sm mt-2">Match score: {(log.plant.best_score * 100).toFixed(1)}%</p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Could not identify plant species from this image.</p>
          )}
        </section>
      )}

      {/* Weather */}
      {log.weather && (
        <section className="card">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
            <Cloud className="w-4 h-4 text-sky-400" /> Weather Monitor
            {log.weatherLocation && (
              <span className="text-xs text-gray-500 font-normal">· {log.weatherLocation}</span>
            )}
          </h3>
          <p className="text-white font-bold text-xl mb-1">{log.weather.location}</p>
          <p className="text-gray-400 text-sm capitalize mb-4">{log.weather.description}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Temp", value: `${log.weather.temperature_c}°C`, icon: Thermometer },
              { label: "Feels", value: `${log.weather.feels_like_c}°C`, icon: Thermometer },
              { label: "Humidity", value: `${log.weather.humidity_pct}%`, icon: Droplets },
              { label: "Wind", value: `${log.weather.wind_speed_ms} m/s`, icon: Wind },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-gray-900 rounded-lg p-3">
                <Icon className="w-3.5 h-3.5 text-gray-500 mb-1" />
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-white text-sm">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-green-200 bg-green-950/40 rounded-lg p-3 border border-green-900/50">
            {log.weather.irrigation_advice}
          </p>
        </section>
      )}

      {/* Risk */}
      {log.riskForecast && (
        <section className="card border-yellow-900/30">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Disease Risk Forecaster
          </h3>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {stripReportMarkdown(log.riskForecast)}
          </div>
        </section>
      )}
    </div>
  );
}
