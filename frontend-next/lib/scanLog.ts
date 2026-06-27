import { PredictResult, PlantIDResult, WeatherData } from "@/lib/api";

export interface ScanLog {
  id: string;
  backendId?: number;
  timestamp: string;
  imageUrl: string;
  prediction: PredictResult;
  plant?: PlantIDResult | null;
  cropReport?: string;
  weather?: WeatherData | null;
  weatherLocation?: string;
  riskForecast?: string;
}

const LOGS_KEY = "sa_scan_logs";
const MAX_LOGS = 25;

export function loadScanLogs(): ScanLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]") as ScanLog[];
  } catch {
    return [];
  }
}

export function saveScanLog(log: ScanLog): void {
  const logs = loadScanLogs().filter((l) => l.id !== log.id);
  logs.unshift(log);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
  localStorage.setItem(
    "sa_last_scan",
    JSON.stringify({ result: log.prediction, imageUrl: log.imageUrl, timestamp: log.timestamp })
  );
  window.dispatchEvent(new Event("sa-last-scan-updated"));
  window.dispatchEvent(new Event("sa-scan-logs-updated"));
}

export function getScanLog(id: string): ScanLog | undefined {
  return loadScanLogs().find((l) => l.id === id || String(l.backendId) === id);
}

export function getScanLogByBackendId(backendId: number): ScanLog | undefined {
  return loadScanLogs().find((l) => l.backendId === backendId);
}

export function scanLogFromHistoryEntry(
  entry: {
    id: number;
    timestamp: string;
    display_name: string;
    crop: string;
    confidence: number;
    severity: string;
    description: string;
    remedies: string[];
    fertilizers: string[];
    prevention: string;
    top5: { class: string; confidence: number }[];
    visual_diagnosis: PredictResult["visual_diagnosis"];
    class_name: string;
    report?: string;
  },
  imageUrl?: string
): ScanLog | null {
  const local = getScanLogByBackendId(entry.id);
  if (local) return local;

  if (!imageUrl) return null;

  let extra: { cropReport?: string; weather?: WeatherData; riskForecast?: string } = {};
  if (entry.report) {
    try {
      extra = JSON.parse(entry.report);
    } catch {
      extra = { cropReport: entry.report };
    }
  }

  return {
    id: `api-${entry.id}`,
    backendId: entry.id,
    timestamp: entry.timestamp,
    imageUrl,
    prediction: {
      class_name: entry.class_name,
      display_name: entry.display_name,
      display_name_translated: entry.display_name,
      crop: entry.crop,
      confidence: entry.confidence,
      severity: entry.severity,
      description: entry.description,
      remedies: entry.remedies,
      fertilizers: entry.fertilizers,
      prevention: entry.prevention,
      top5: entry.top5,
      visual_diagnosis: entry.visual_diagnosis || [],
      prediction_id: entry.id,
      user_id: "",
    },
    cropReport: extra.cropReport,
    weather: extra.weather ?? null,
    riskForecast: extra.riskForecast,
  };
}
