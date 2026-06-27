"use client";
import { useState } from "react";
import { api, PlantIDResult } from "@/lib/api";
import { Upload, Loader2, Leaf } from "lucide-react";

interface Props { lang: string; }

export default function PlantIdentifier({ lang: _lang }: Props) {
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult]   = useState<PlantIDResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function identify() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const res = await api.identifyPlant(file);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Identification failed.");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Plant Species Identifier</h2>
        <p className="text-gray-500 text-sm mb-4">Upload a leaf or plant photo to identify the species using PlantNet AI.</p>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl cursor-pointer min-h-40 bg-gray-800/50 mb-4">
          <input type="file" accept="image/*" className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); }
            }} />
          {preview
            ? <img src={preview} alt="plant" className="max-h-36 rounded-lg object-contain" />
            : <><Upload className="w-8 h-8 text-gray-600 mb-2" /><p className="text-gray-500 text-sm">Click to upload</p></>}
        </label>

        {file && (
          <button onClick={identify} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Identifying..." : "Identify Plant"}
          </button>
        )}
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {result?.found && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-white">{result.best_match}</h3>
            <span className="ml-auto text-green-400 text-sm">{(result.best_score * 100).toFixed(1)}%</span>
          </div>
          {result.common_names.length > 0 && (
            <p className="text-gray-400 text-sm">Common: {result.common_names.join(", ")}</p>
          )}
          {result.family && <p className="text-gray-500 text-sm">Family: {result.family}</p>}

          {result.results.slice(1, 4).map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-gray-300 text-sm">{r.scientific_name}</span>
              <span className="text-gray-500 text-xs">{(r.score * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
