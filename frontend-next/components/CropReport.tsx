"use client";
import { useState } from "react";
import { api, PredictResult, ReportRequest } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import { FileText, Upload, Loader2, Volume2 } from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function CropReport({ lang, speechLang }: Props) {
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictResult | null>(null);
  const [report, setReport]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState<"upload" | "analyzing" | "report">("upload");
  const tts = new TTSPlayer();

  async function generate() {
    if (!file) return;
    setLoading(true); setStep("analyzing");
    try {
      const pred = await api.predict(file, lang);
      setPrediction(pred);
      const payload: ReportRequest = {
        class_name: pred.class_name, display_name: pred.display_name,
        crop: pred.crop, confidence: pred.confidence, severity: pred.severity,
        remedies: pred.remedies, fertilizers: pred.fertilizers, prevention: pred.prevention,
      };
      const res = await api.generateReport(payload);
      setReport(res.report);
      setStep("report");
    } catch (e: unknown) {
      setReport("Report generation failed: " + (e instanceof Error ? e.message : "Unknown error"));
      setStep("report");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="card">
        <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-400" /> AI Crop Report Generator
        </h2>
        <p className="text-gray-500 text-sm mb-4">Upload a leaf image. Gemma AI generates a comprehensive crop health report.</p>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl cursor-pointer min-h-36 bg-gray-800/50 mb-4">
          <input type="file" accept="image/*" className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setReport(""); setStep("upload"); }
            }} />
          {preview
            ? <img src={preview} alt="leaf" className="max-h-32 rounded-lg object-contain" />
            : <><Upload className="w-8 h-8 text-gray-600 mb-2" /><p className="text-gray-500 text-sm">Click to upload leaf photo</p></>}
        </label>

        {file && (
          <button onClick={generate} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === "analyzing" ? "Generating Report..." : "Generate AI Report"}
          </button>
        )}
      </div>

      {prediction && step === "report" && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">{prediction.display_name}</h3>
              <p className="text-gray-500 text-xs">{prediction.crop} · {prediction.confidence.toFixed(1)}% confidence</p>
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
