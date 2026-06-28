import { api, HistoryEntry, PredictResult, PlantIDResult, StatsData, WeatherData } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { IotSensorData } from "@/lib/iotData";
import { isPersistedImageUrl } from "@/lib/persistImage";
import { userStorageKey } from "@/lib/userStorage";

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
  lat?: number;
  lon?: number;
  riskForecast?: string;
  iotData?: IotSensorData | null;
}

const LOGS_BASE = "sa_scan_logs";
const LAST_SCAN_BASE = "sa_last_scan";
const MAX_LOGS = 25;

export function scanLogsStorageKey(): string {
  return userStorageKey(LOGS_BASE);
}

function logsKey(): string {
  return scanLogsStorageKey();
}

function lastScanKey(): string {
  return userStorageKey(LAST_SCAN_BASE);
}

function normalizeImageUrl(url?: string): string {
  if (!url || !isPersistedImageUrl(url)) return "";
  return url;
}

export function loadScanLogs(): ScanLog[] {
  if (typeof window === "undefined" || !getUser()) return [];
  try {
    const logs = JSON.parse(localStorage.getItem(logsKey()) || "[]") as ScanLog[];
    return logs.map((log) => ({
      ...log,
      imageUrl: normalizeImageUrl(log.imageUrl),
    }));
  } catch {
    return [];
  }
}

/** Replace local cache with server-synced logs for the current user. */
export function replaceLocalScanLogs(logs: ScanLog[]): void {
  if (typeof window === "undefined" || !getUser()) return;
  localStorage.setItem(logsKey(), JSON.stringify(logs.slice(0, MAX_LOGS)));
  window.dispatchEvent(new Event("sa-scan-logs-updated"));
}

export function saveScanLog(log: ScanLog): void {
  if (!getUser()) return;
  const logs = loadScanLogs().filter((l) => l.id !== log.id);
  logs.unshift(log);
  localStorage.setItem(logsKey(), JSON.stringify(logs.slice(0, MAX_LOGS)));
  localStorage.setItem(
    lastScanKey(),
    JSON.stringify({
      result: log.prediction,
      imageUrl: log.imageUrl,
      timestamp: log.timestamp,
      iotData: log.iotData ?? null,
    })
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

export function scanLogFromHistoryEntry(entry: HistoryEntry): ScanLog | null {
  const imageUrl = normalizeImageUrl(entry.image_data);
  const reportMeta = entry.scan_report_json;
  const plant = (entry.plant_json as PlantIDResult | null) ?? null;
  const weather = (entry.weather_json as WeatherData | null) ?? null;

  let cropReport = reportMeta?.cropReport;
  let riskForecast = reportMeta?.riskForecast;
  let weatherLocation = reportMeta?.weatherLocation;
  let lat = reportMeta?.lat;
  let lon = reportMeta?.lon;
  let iotData = reportMeta?.iotData as IotSensorData | null | undefined;

  if (entry.report && !cropReport) {
    try {
      const extra = JSON.parse(entry.report);
      cropReport = extra.cropReport ?? cropReport;
      riskForecast = extra.riskForecast ?? riskForecast;
    } catch {
      cropReport = entry.report;
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
      dataset_prediction: entry.dataset_prediction ?? null,
      prediction_id: entry.id,
      user_id: entry.user_id || getUser()?.user_id || "",
    },
    plant,
    cropReport,
    weather,
    weatherLocation,
    lat,
    lon,
    riskForecast,
    iotData: iotData ?? null,
  };
}

/** Build list entries from /api/stats when /api/history is unavailable. */
export function logsFromStatsFallback(stats: StatsData): ScanLog[] {
  const recent = stats.recent_predictions || [];
  if (recent.length > 0) {
    return recent.map((r, idx) => {
      const crop = r.crop || stats.crop_breakdown[0]?.crop || "Crop";
      const display = r.display_name || r.class_name.replace(/_/g, " ");
      return {
        id: `stats-recent-${idx}-${r.timestamp}`,
        timestamp: r.timestamp,
        imageUrl: "",
        prediction: {
          class_name: r.class_name,
          display_name: display,
          display_name_translated: display,
          crop,
          confidence: r.confidence,
          severity: r.severity || (r.confidence >= 70 ? "High" : r.confidence >= 40 ? "Medium" : "Low"),
          description: "",
          remedies: [],
          fertilizers: [],
          prevention: "",
          top5: [],
          visual_diagnosis: [],
          user_id: getUser()?.user_id || "",
        },
      };
    });
  }

  return stats.crop_breakdown.map((c, idx) => ({
    id: `stats-crop-${idx}-${c.crop}`,
    timestamp: new Date().toISOString(),
    imageUrl: "",
    prediction: {
      class_name: c.crop,
      display_name: c.crop,
      display_name_translated: c.crop,
      crop: c.crop,
      confidence: 0,
      severity: "Unknown",
      description: "",
      remedies: [],
      fertilizers: [],
      prevention: "",
      top5: [],
      visual_diagnosis: [],
      user_id: getUser()?.user_id || "",
    },
  }));
}

/** Merge server history with per-browser local logs (local enriches when server row is sparse). */
export function mergeScanLogs(localLogs: ScanLog[], apiEntries: HistoryEntry[]): ScanLog[] {
  const localByBackend = new Map<number, ScanLog>();
  for (const log of localLogs) {
    if (log.backendId != null) localByBackend.set(log.backendId, log);
  }

  const merged: ScanLog[] = [];
  const seen = new Set<string>();

  for (const entry of apiEntries) {
    const fromApi = scanLogFromHistoryEntry(entry);
    if (!fromApi) continue;

    const local = localByBackend.get(entry.id);
    if (local) {
      merged.push({
        ...fromApi,
        imageUrl: fromApi.imageUrl || local.imageUrl,
        plant: fromApi.plant?.found ? fromApi.plant : local.plant,
        cropReport: fromApi.cropReport || local.cropReport,
        weather: fromApi.weather || local.weather,
        weatherLocation: fromApi.weatherLocation || local.weatherLocation,
        lat: fromApi.lat ?? local.lat,
        lon: fromApi.lon ?? local.lon,
        riskForecast: fromApi.riskForecast || local.riskForecast,
        iotData: fromApi.iotData ?? local.iotData,
      });
      seen.add(local.id);
      seen.add(fromApi.id);
      continue;
    }

    merged.push(fromApi);
    seen.add(fromApi.id);
  }

  for (const log of localLogs) {
    if (!seen.has(log.id)) merged.push(log);
  }

  return merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/** Fetch history from server and refresh local cache (call on login). */
export async function syncScanLogsFromServer(): Promise<ScanLog[]> {
  if (!getUser()) return [];
  try {
    const apiHistory = await api.history();
    const merged = mergeScanLogs([], apiHistory);
    replaceLocalScanLogs(merged);
    return merged;
  } catch {
    return loadScanLogs();
  }
}

/** Push full scan payload to server after pipeline completes. */
export async function syncScanLogToServer(log: ScanLog): Promise<void> {
  if (!log.backendId || !getUser()) return;
  try {
    await api.updatePrediction(log.backendId, {
      image_data: log.imageUrl,
      plant: log.plant ?? null,
      weather: log.weather ?? null,
      crop_report: log.cropReport ?? "",
      risk_forecast: log.riskForecast ?? "",
      iot_data: log.iotData ?? null,
      lat: log.lat,
      lon: log.lon,
      location: log.weatherLocation ?? "",
    });
  } catch {
    // Local cache remains; server sync can retry on next login
  }
}
