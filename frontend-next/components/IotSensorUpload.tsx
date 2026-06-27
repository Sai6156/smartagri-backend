"use client";
import { useState } from "react";
import {
  IotFormat,
  IotSensorData,
  IOT_EXAMPLES,
  IOT_FORMAT_LABELS,
  parseIotFile,
  parseIotInput,
} from "@/lib/iotData";
import IotDataPanel from "@/components/IotDataPanel";
import { Cpu, ChevronDown, ChevronUp, Upload, X, CheckCircle2 } from "lucide-react";

interface Props {
  value: IotSensorData | null;
  onChange: (data: IotSensorData | null) => void;
  disabled?: boolean;
}

export default function IotSensorUpload({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<IotFormat>("json");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function applyDraft() {
    setError("");
    const parsed = parseIotInput(draft, format);
    if (!parsed.summary.trim()) {
      setError("Enter sensor data or upload a file.");
      return;
    }
    onChange(parsed);
    setOpen(false);
  }

  async function handleFile(file: File) {
    setError("");
    const ext = file.name.split(".").pop()?.toLowerCase();
    let fmt: IotFormat = format;
    if (ext === "json") fmt = "json";
    else if (ext === "csv") fmt = "csv";
    else if (ext === "txt") fmt = "text";
    setFormat(fmt);
    try {
      const parsed = await parseIotFile(file, fmt);
      if (!parsed.summary.trim()) {
        setError("Could not read sensor data from that file.");
        return;
      }
      setDraft(parsed.raw);
      onChange(parsed);
      setOpen(false);
    } catch {
      setError("Failed to read file.");
    }
  }

  function clear() {
    setDraft("");
    setError("");
    onChange(null);
  }

  function loadExample() {
    setDraft(IOT_EXAMPLES[format]);
    setError("");
  }

  return (
    <div className="card py-3 px-4 border-dashed border-white/10">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">IoT sensor data</p>
            <p className="text-xs text-gray-500 truncate">
              Optional — JSON, CSV, key-value, or free text
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {value?.summary && (
            <span className="text-xs text-cyan-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Attached
            </span>
          )}
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {value?.summary && !open && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-xs text-cyan-400">Attached — will be used in report & chat</p>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="text-gray-500 hover:text-red-400 p-1 flex-shrink-0"
              title="Remove IoT data"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <IotDataPanel data={value} compact />
        </div>
      )}

      {open && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(IOT_FORMAT_LABELS) as IotFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setFormat(f);
                  setDraft(IOT_EXAMPLES[f]);
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  format === f
                    ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                {IOT_FORMAT_LABELS[f]}
              </button>
            ))}
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            placeholder={IOT_EXAMPLES[format]}
            rows={6}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 resize-y"
          />

          <div className="flex flex-wrap gap-2 items-center">
            <label className="btn-secondary text-xs flex items-center gap-1.5 py-2 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload file
              <input
                type="file"
                accept=".json,.csv,.txt,text/plain,application/json"
                className="hidden"
                disabled={disabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" onClick={loadExample} disabled={disabled} className="btn-secondary text-xs py-2">
              Load example
            </button>
            <button type="button" onClick={applyDraft} disabled={disabled} className="btn-primary text-xs py-2">
              Attach to scan
            </button>
            {value && (
              <button type="button" onClick={clear} disabled={disabled} className="btn-secondary text-xs py-2">
                Clear
              </button>
            )}
          </div>

          {error && <p className="text-xs text-amber-400">{error}</p>}
          <p className="text-xs text-gray-600">
            If attached, sensor readings are included in crop report, risk forecast, and AI chatbot for this scan.
          </p>
        </div>
      )}
    </div>
  );
}
