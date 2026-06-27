"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getBrowserGps, loadUserLocation, saveUserLocation } from "@/lib/location";
import { ScanLog, saveScanLog } from "@/lib/scanLog";
import ScanResultsView from "@/components/ScanResultsView";
import { Upload, Loader2, CheckCircle2, Circle, Leaf, RotateCcw } from "lucide-react";

interface Props {
  lang: string;
  loadedLog?: ScanLog | null;
  onNewScan?: () => void;
}

const PIPELINE = [
  "Disease detection",
  "Plant identification",
  "Weather monitor",
  "AI crop report",
  "Risk forecaster",
] as const;

type StepStatus = "pending" | "running" | "done" | "error";

export default function HomeHub({ lang, loadedLog, onNewScan }: Props) {
  const [activeLog, setActiveLog] = useState<ScanLog | null>(loadedLog ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [stepStatus, setStepStatus] = useState<StepStatus[]>(PIPELINE.map(() => "pending"));
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (loadedLog) {
      setActiveLog(loadedLog);
      setPreview(loadedLog.imageUrl);
      setStepStatus(PIPELINE.map(() => "done"));
      setError("");
    }
  }, [loadedLog]);

  const setStep = useCallback((idx: number, status: StepStatus) => {
    setStepStatus((prev) => {
      const next = [...prev];
      next[idx] = status;
      return next;
    });
  }, []);

  async function resolveLocation(): Promise<{ lat: number; lon: number; city: string }> {
    const saved = loadUserLocation();
    if (saved) return { lat: saved.lat, lon: saved.lon, city: saved.city };

    try {
      const gps = await getBrowserGps();
      const geo = await api.reverseGeocode(gps.lat, gps.lon);
      saveUserLocation({
        lat: gps.lat,
        lon: gps.lon,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        source: "gps",
      });
      return { lat: gps.lat, lon: gps.lon, city: geo.city };
    } catch {
      return { lat: 17.385, lon: 78.4867, city: "Hyderabad" };
    }
  }

  async function runPipeline(file: File, imageUrl: string) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setError("");
    setActiveLog(null);
    setStepStatus(PIPELINE.map(() => "pending"));

    try {
      setStep(0, "running");
      const prediction = await api.predict(file, lang);
      setStep(0, "done");

      setStep(1, "running");
      let plant = null;
      try {
        plant = await api.identifyPlant(file);
      } catch {
        plant = null;
      }
      setStep(1, "done");

      const { lat, lon, city } = await resolveLocation();

      setStep(2, "running");
      let weather = null;
      try {
        weather = await api.weather(lat, lon);
      } catch {
        weather = null;
      }
      setStep(2, "done");

      setStep(3, "running");
      let cropReport = "";
      try {
        const reportRes = await api.generateReport({
          class_name: prediction.class_name,
          display_name: prediction.display_name,
          crop: prediction.crop,
          confidence: prediction.confidence,
          severity: prediction.severity,
          remedies: prediction.remedies,
          fertilizers: prediction.fertilizers,
          prevention: prediction.prevention,
          lat,
          lon,
          location: city,
        });
        cropReport = reportRes.report;
        if (!weather && reportRes.weather) weather = reportRes.weather;
      } catch (e) {
        cropReport = "Report could not be generated.";
      }
      setStep(3, "done");

      setStep(4, "running");
      let riskForecast = "";
      try {
        const riskRes = await api.riskForecast(prediction.crop, lat, lon, city);
        riskForecast = riskRes.forecast;
        if (!weather && riskRes.weather) weather = riskRes.weather;
      } catch {
        riskForecast = "Risk forecast could not be generated.";
      }
      setStep(4, "done");

      const log: ScanLog = {
        id: crypto.randomUUID(),
        backendId: prediction.prediction_id,
        timestamp: new Date().toISOString(),
        imageUrl,
        prediction,
        plant,
        cropReport,
        weather,
        weatherLocation: city,
        riskForecast,
      };

      saveScanLog(log);
      setActiveLog(log);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      setStepStatus((prev) =>
        prev.map((s) => (s === "running" ? "error" : s))
      );
    } finally {
      setRunning(false);
      runningRef.current = false;
    }
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    onNewScan?.();
    const url = URL.createObjectURL(file);
    setPreview(url);
    void runPipeline(file, url);
  }

  function handleReset() {
    setActiveLog(null);
    setPreview(null);
    setError("");
    setStepStatus(PIPELINE.map(() => "pending"));
    onNewScan?.();
    if (fileRef.current) fileRef.current.value = "";
  }

  const showUpload = !activeLog && !running;
  const isArchive = Boolean(loadedLog && activeLog?.id === loadedLog.id);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl lg:text-4xl font-bold text-white font-serif tracking-tight">
          Smart Leaf Analysis
        </h1>
        <p className="text-gray-500 text-sm max-w-lg mx-auto">
          Upload one leaf image — we automatically run disease detection, plant ID, crop report, weather, and risk forecast.
        </p>
      </div>

      {/* Upload zone */}
      {(showUpload || running) && (
        <label
          className={`dropzone block cursor-pointer p-10 text-center ${running ? "dropzone-active pointer-events-none" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={running}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {preview && running ? (
            <div className="space-y-4">
              <img src={preview} alt="Uploading" className="mx-auto max-h-40 rounded-xl object-contain" />
              <div className="flex items-center justify-center gap-2 text-green-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Analyzing your leaf…</span>
              </div>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Upload className="w-7 h-7 text-green-400" />
              </div>
              <p className="text-white font-semibold text-lg">Upload Leaf Image</p>
              <p className="text-gray-500 text-sm mt-1">Drag & drop or click to browse</p>
              <p className="text-gray-600 text-xs mt-3">JPG, PNG, WEBP · Analysis starts automatically</p>
            </>
          )}
        </label>
      )}

      {/* Progress */}
      {running && (
        <div className="card space-y-3">
          {PIPELINE.map((label, i) => {
            const status = stepStatus[i];
            return (
              <div key={label} className="flex items-center gap-3">
                {status === "done" && <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />}
                {status === "running" && <Loader2 className="w-4 h-4 text-green-400 animate-spin flex-shrink-0" />}
                {status === "error" && <Circle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                {status === "pending" && <Circle className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                <span className={`text-sm ${status === "running" ? "text-white" : status === "done" ? "text-gray-400" : "text-gray-600"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="card border-red-900/50 bg-red-950/20 text-red-300 text-sm text-center py-4">
          {error}
        </div>
      )}

      {/* Results */}
      {activeLog && !running && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {isArchive ? (
              <p className="text-sm text-amber-400/90 flex items-center gap-2">
                <Leaf className="w-4 h-4" /> Viewing saved scan from history
              </p>
            ) : (
              <p className="text-sm text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Analysis complete — saved to History & Stats
              </p>
            )}
            <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" /> New scan
            </button>
          </div>
          <ScanResultsView log={activeLog} isArchive={isArchive} />
        </div>
      )}
    </div>
  );
}
