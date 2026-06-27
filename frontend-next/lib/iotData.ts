/** Optional IoT sensor readings — parsed client-side, sent to LLM as plain text. */

export type IotFormat = "json" | "csv" | "keyvalue" | "text";

export interface IotReading {
  sensor: string;
  value: string;
  unit?: string;
}

export interface IotDevice {
  id: string;
  type: string;
  battery: string;
  status: string;
}

export interface IotAlert {
  severity: string;
  message: string;
}

export interface IotDisplayGroup {
  id: string;
  title: string;
  type: "metrics" | "devices" | "alerts";
  readings: IotReading[];
  devices?: IotDevice[];
  alerts?: IotAlert[];
}

export interface IotSensorData {
  format: IotFormat;
  raw: string;
  summary: string;
  readings: IotReading[];
  groups: IotDisplayGroup[];
  fileName?: string;
}

export const IOT_FORMAT_LABELS: Record<IotFormat, string> = {
  json: "JSON",
  csv: "CSV",
  keyvalue: "Key-Value",
  text: "Free text",
};

const GROUP_TITLES: Record<string, string> = {
  farm: "Farm",
  weather: "Weather Sensors",
  soil: "Soil Sensors",
  irrigation: "Irrigation",
  plant_health: "Plant Health",
  devices: "Field Devices",
  alerts: "Sensor Alerts",
};

function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupTitle(key: string): string {
  return GROUP_TITLES[key] || titleCase(key);
}

function fieldLabel(key: string): string {
  return titleCase(key.replace(/_percent$/, "").replace(/_c$/, " (°C)").replace(/_mm$/, " (mm)").replace(/_ppm$/, " (ppm)").replace(/_lpm$/, " (L/min)").replace(/_liters$/, " (L)").replace(/_kmph$/, " (km/h)").replace(/_wm2$/, " (W/m²)").replace(/_dsm$/, " (dS/m)").replace(/_acres$/, " (acres)"));
}

function inferUnit(key: string): string | undefined {
  if (key.endsWith("_percent") || key.includes("moisture") && key.includes("percent")) return "%";
  if (key.endsWith("_c") || key.includes("temperature")) return "°C";
  if (key.endsWith("_mm")) return "mm";
  if (key.endsWith("_ppm")) return "ppm";
  if (key.endsWith("_lpm")) return "L/min";
  if (key.endsWith("_liters")) return "L";
  if (key.endsWith("_kmph")) return "km/h";
  if (key.endsWith("_wm2")) return "W/m²";
  if (key.endsWith("_dsm")) return "dS/m";
  if (key.endsWith("_acres")) return "acres";
  return undefined;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      try {
        return new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      } catch {
        return v;
      }
    }
    return v;
  }
  if (Array.isArray(v)) return `${v.length} items`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function pushReading(out: IotReading[], sensor: string, value: string, unit?: string) {
  const s = sensor.trim();
  const v = String(value).trim();
  if (s && v && v !== "—") out.push({ sensor: s, value: v, unit: unit?.trim() || undefined });
}

function flattenJsonObject(
  obj: Record<string, unknown>,
  prefix: string,
  flat: IotReading[]
): IotReading[] {
  const items: IotReading[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const label = fieldLabel(k);
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) continue;
    const unit = inferUnit(k);
    const formatted = formatValue(v);
    pushReading(items, label, formatted, unit);
    pushReading(flat, fullKey, formatted, unit);
  }
  return items;
}

function parseJsonStructure(data: unknown): { readings: IotReading[]; groups: IotDisplayGroup[] } {
  const flat: IotReading[] = [];
  const groups: IotDisplayGroup[] = [];

  if (!data || typeof data !== "object") return { readings: flat, groups };

  if (Array.isArray(data)) {
    for (const row of data) {
      if (row && typeof row === "object") {
        const items = flattenJsonObject(row as Record<string, unknown>, "row", flat);
        if (items.length) {
          groups.push({ id: `row-${groups.length}`, title: "Readings", type: "metrics", readings: items });
        }
      }
    }
    return { readings: flat, groups };
  }

  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const title = groupTitle(key);

    if (key === "devices" && Array.isArray(val)) {
      const devices: IotDevice[] = val
        .filter((d) => d && typeof d === "object")
        .map((d) => {
          const o = d as Record<string, unknown>;
          pushReading(flat, `device.${o.device_id ?? o.id}`, `${o.type} — ${o.status} (${o.battery_percent}% battery)`);
          return {
            id: String(o.device_id ?? o.id ?? "—"),
            type: String(o.type ?? "Sensor"),
            battery: o.battery_percent != null ? `${o.battery_percent}%` : "—",
            status: String(o.status ?? "—"),
          };
        });
      groups.push({ id: key, title, type: "devices", readings: [], devices });
    } else if (key === "alerts" && Array.isArray(val)) {
      const alerts: IotAlert[] = val
        .filter((a) => a && typeof a === "object")
        .map((a) => {
          const o = a as Record<string, unknown>;
          const severity = String(o.severity ?? "Info");
          const message = String(o.message ?? "");
          pushReading(flat, `alert`, `${severity}: ${message}`);
          return { severity, message };
        });
      groups.push({ id: key, title, type: "alerts", readings: [], alerts });
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const items = flattenJsonObject(val as Record<string, unknown>, key, flat);
      groups.push({ id: key, title, type: "metrics", readings: items });
    } else {
      const unit = inferUnit(key);
      const formatted = formatValue(val);
      const item = { sensor: fieldLabel(key), value: formatted, unit };
      groups.push({ id: key, title, type: "metrics", readings: [item] });
      pushReading(flat, key, formatted, unit);
    }
  }

  return { readings: flat, groups };
}

function readingsToSummary(readings: IotReading[]): string {
  return readings
    .map((r) => (r.unit ? `${r.sensor}: ${r.value} ${r.unit}` : `${r.sensor}: ${r.value}`))
    .join("\n");
}

export function formatIotContext(iot?: IotSensorData | null): string {
  if (!iot?.summary?.trim()) return "";
  return `IoT FIELD SENSOR DATA (from farmer's upload, format: ${iot.format}):\n${iot.summary.trim()}`;
}

export function parseIotInput(raw: string, format: IotFormat): IotSensorData {
  const trimmed = raw.trim();
  const empty: IotSensorData = { format, raw: "", summary: "", readings: [], groups: [] };

  if (!trimmed) return empty;

  try {
    if (format === "json") {
      const data = JSON.parse(trimmed) as unknown;
      const { readings, groups } = parseJsonStructure(data);
      return {
        format,
        raw: trimmed,
        readings,
        groups,
        summary: readingsToSummary(readings) || trimmed,
      };
    }

    if (format === "csv") {
      const readings: IotReading[] = [];
      const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length >= 2) {
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        const values = lines[1].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        headers.forEach((h, i) => pushReading(readings, fieldLabel(h), values[i] ?? ""));
      }
      return {
        format,
        raw: trimmed,
        readings,
        groups: readings.length
          ? [{ id: "csv", title: "Sensor Readings", type: "metrics", readings }]
          : [],
        summary: readingsToSummary(readings) || trimmed,
      };
    }

    if (format === "keyvalue") {
      const readings: IotReading[] = [];
      for (const line of trimmed.split(/\r?\n/)) {
        const m = line.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);
        if (m) pushReading(readings, m[1].trim(), m[2].trim());
      }
      return {
        format,
        raw: trimmed,
        readings,
        groups: readings.length
          ? [{ id: "kv", title: "Sensor Readings", type: "metrics", readings }]
          : [],
        summary: readingsToSummary(readings) || trimmed,
      };
    }

    return {
      format,
      raw: trimmed,
      readings: [{ sensor: "Field log", value: trimmed }],
      groups: [{ id: "text", title: "Sensor Log", type: "metrics", readings: [{ sensor: "Field log", value: trimmed }] }],
      summary: trimmed,
    };
  } catch {
    return {
      format,
      raw: trimmed,
      readings: [{ sensor: "Field log", value: trimmed }],
      groups: [{ id: "raw", title: "Sensor Log", type: "metrics", readings: [{ sensor: "Field log", value: trimmed }] }],
      summary: trimmed,
    };
  }
}

export async function parseIotFile(file: File, format: IotFormat): Promise<IotSensorData> {
  const text = await file.text();
  const parsed = parseIotInput(text, format);
  return { ...parsed, fileName: file.name };
}

export const IOT_EXAMPLES: Record<IotFormat, string> = {
  json: `{
  "soil": {
    "soil_moisture_percent": 42,
    "soil_temperature_c": 26.5,
    "soil_ph": 6.8
  },
  "weather": {
    "air_temperature_c": 31.8,
    "humidity_percent": 68
  }
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
