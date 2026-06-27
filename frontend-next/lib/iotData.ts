/** Optional IoT sensor readings — parsed client-side, sent to LLM as plain text. */

export type IotFormat = "json" | "csv" | "keyvalue" | "text";

export interface IotReading {
  sensor: string;
  value: string;
  unit?: string;
}

export interface IotSensorData {
  format: IotFormat;
  raw: string;
  summary: string;
  readings: IotReading[];
  fileName?: string;
}

export const IOT_FORMAT_LABELS: Record<IotFormat, string> = {
  json: "JSON",
  csv: "CSV",
  keyvalue: "Key-Value",
  text: "Free text",
};

export function formatIotContext(iot?: IotSensorData | null): string {
  if (!iot?.summary?.trim()) return "";
  return `IoT FIELD SENSOR DATA (from farmer's upload, format: ${iot.format}):\n${iot.summary.trim()}`;
}

function pushReading(out: IotReading[], sensor: string, value: string, unit?: string) {
  const s = sensor.trim();
  const v = String(value).trim();
  if (s && v) out.push({ sensor: s, value: v, unit: unit?.trim() || undefined });
}

function readingsToSummary(readings: IotReading[], raw: string, format: IotFormat): string {
  if (readings.length) {
    return readings
      .map((r) => (r.unit ? `${r.sensor}: ${r.value} ${r.unit}` : `${r.sensor}: ${r.value}`))
      .join("\n");
  }
  return raw.trim();
}

export function parseIotInput(raw: string, format: IotFormat): IotSensorData {
  const trimmed = raw.trim();
  const readings: IotReading[] = [];

  if (!trimmed) {
    return { format, raw: "", summary: "", readings: [] };
  }

  try {
    if (format === "json") {
      const data = JSON.parse(trimmed) as unknown;
      if (Array.isArray(data)) {
        for (const row of data) {
          if (row && typeof row === "object") {
            for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
              pushReading(readings, k, String(v));
            }
          }
        }
      } else if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          if (v && typeof v === "object" && !Array.isArray(v)) {
            const o = v as Record<string, unknown>;
            const val = o.value ?? o.reading ?? JSON.stringify(o);
            pushReading(readings, k, String(val), o.unit ? String(o.unit) : undefined);
          } else {
            pushReading(readings, k, String(v));
          }
        }
      }
    } else if (format === "csv") {
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length >= 2) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        const values = lines[1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        headers.forEach((h, i) => pushReading(readings, h, values[i] ?? ""));
      } else if (lines.length === 1) {
        const parts = lines[0].split(",").map((p) => p.trim());
        parts.forEach((p, i) => pushReading(readings, `field_${i + 1}`, p));
      }
    } else if (format === "keyvalue") {
      for (const line of trimmed.split(/\r?\n/)) {
        const m = line.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);
        if (m) pushReading(readings, m[1], m[2]);
      }
    } else {
      // free text — pass through for Gemma to interpret
      readings.push({ sensor: "sensor_log", value: trimmed });
    }
  } catch {
    readings.push({ sensor: "sensor_log", value: trimmed });
  }

  return {
    format,
    raw: trimmed,
    readings,
    summary: readingsToSummary(readings, trimmed, format),
  };
}

export async function parseIotFile(file: File, format: IotFormat): Promise<IotSensorData> {
  const text = await file.text();
  const parsed = parseIotInput(text, format);
  return { ...parsed, fileName: file.name };
}

export const IOT_EXAMPLES: Record<IotFormat, string> = {
  json: `{
  "soil_moisture": 42,
  "soil_temperature_c": 26.5,
  "ph": 6.8,
  "humidity_pct": 71
}`,
  csv: `sensor,value,unit
soil_moisture,42,percent
soil_temperature,26.5,celsius
ph,6.8,
humidity,71,percent`,
  keyvalue: `soil_moisture: 42%
soil_temperature: 26.5 C
ph: 6.8
humidity: 71%`,
  text: `Field node A — soil moisture 42%, temp 26.5°C, pH 6.8, NPK low on potassium.`,
};
