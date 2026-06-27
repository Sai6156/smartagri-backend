"use client";
import { useEffect, useState } from "react";
import { api, PredictResult, ReportRequest } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import { FileText, Loader2, Volume2, RefreshCw } from "lucide-react";

interface Props { lang: string; speechLang: string; }

function loadLastScan(): { result: PredictResult; imageUrl?: string; timestamp?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sa_last_scan");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function CropReport({ lang: _lang, speechLang }: Props) {
  const [scan, setScan] = useState<{ result: PredictResult; imageUrl?: string; timestamp?: string } | null>(null);
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const tts = new TTSPlayer();

  useEffect(() => {
    const refresh = () => setScan(loadLastScan());
    refresh();
    window.addEventListener("sa-last-scan-updated", refresh);
    return () => window.removeEventListener("sa-last-scan-updated", refresh);
  }, []);

  async function generate() {
    if (!scan?.result) return;
    setLoading(true);
    setReport("");
    try {
      const pred = scan.result;
      const payload: ReportRequest = {
        class_name: pred.class_name,
        display_name: pred.display_name,
        crop: pred.crop,
        confidence: pred.confidence,
        severity: pred.severity,
        remedies: pred.remedies,
        fertilizers: pred.fertilizers,
        prevention: pred.prevention,
      };
      const res = await api.generateReport(payload);
      setReport(res.report);
    } catch (e: unknown) {
      setReport("Report generation failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  const pred = scan?.result;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="card">
        <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-400" /> AI Crop Report Generator
        </h2>
        <p className="text-gray-500 text-sm mb-4">
          This page now reuses your latest Disease Detector scan automatically. No second upload needed.
        </p>

        {!pred ? (
          <div className="bg-yellow-950/30 border border-yellow-900 rounded-xl p-4 text-yellow-200 text-sm">
            No scan context found. Go to Disease Detector once, upload the leaf, and every other feature will reuse that result.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl p-4 flex gap-4 items-center">
            {scan.imageUrl && <img src={scan.imageUrl} alt="latest scan" className="w-24 h-20 object-cover rounded-lg" />}
            <div className="flex-1">
              <p className="text-xs text-green-400 uppercase tracking-wide font-semibold">Using latest scan</p>
              <h3 className="font-bold text-white">{pred.display_name}</h3>
              <p className="text-gray-500 text-sm">{pred.crop} · {pred.confidence.toFixed(1)}% · {pred.severity}</p>
              {pred.visual_diagnosis?.[0] && (
                <p className="text-blue-300 text-xs mt-1">Gemma top visual possibility: {pred.visual_diagnosis[0].disease}</p>
              )}
            </div>
          </div>
        )}

        {pred && (
          <button onClick={generate} disabled={loading} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Generating Report..." : report ? "Regenerate AI Report" : "Generate AI Report From Latest Scan"}
          </button>
        )}
      </div>

      {report && pred && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">{pred.display_name}</h3>
              <p className="text-gray-500 text-xs">{pred.crop} · {pred.confidence.toFixed(1)}% confidence</p>
            </div>
            <button onClick={() => tts.speak(report, speechLang)} className="btn-secondary text-xs flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5" /> Listen
            </button>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {report}
          </div>
        </div>
      )}
    </div>
  );
}
