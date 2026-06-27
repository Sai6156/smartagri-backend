import { PredictResult } from "@/lib/api";
import { formatIotContext, IotSensorData } from "@/lib/iotData";

export interface LastScan {
  result: PredictResult;
  imageUrl?: string;
  timestamp?: string;
  iotData?: IotSensorData | null;
}

export function loadLastScan(): LastScan | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sa_last_scan");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastScan;
  } catch {
    return null;
  }
}

/** Text context injected into every chat/voice prompt when a scan is attached. */
export function buildScanContext(scan: LastScan): string {
  const r = scan.result;
  const visual = (r.visual_diagnosis || [])
    .slice(0, 3)
    .map((v) => `${v.disease} (${v.confidence}%): ${v.visual_reason}`)
    .join("; ");

  return [
    "LEAF SCAN ALREADY COMPLETED — do NOT ask the farmer to upload or attach a photo.",
    `Crop: ${r.crop}`,
    `Disease: ${r.display_name} (${r.confidence.toFixed(1)}% confidence)`,
    `Severity: ${r.severity}`,
    `Description: ${r.description}`,
    `Remedies: ${r.remedies.join(", ")}`,
    `Prevention: ${r.prevention}`,
    visual ? `Visual AI second opinion: ${visual}` : "",
    scan.timestamp ? `Scanned: ${new Date(scan.timestamp).toLocaleString()}` : "",
    formatIotContext(scan.iotData),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Remove markdown so TTS does not read "asterisk asterisk". */
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
