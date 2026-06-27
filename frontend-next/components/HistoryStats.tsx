"use client";
import { useState, useEffect } from "react";
import { api, HistoryEntry, StatsData } from "@/lib/api";
import { Loader2, History, X } from "lucide-react";

interface Props { lang: string; }

export default function HistoryStats({ lang: _lang }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    Promise.all([api.history(), api.stats()])
      .then(([h, s]) => { setHistory(h); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  const SEV_COLOR: Record<string, string> = {
    High: "text-red-400", Medium: "text-yellow-400", Low: "text-green-400", None: "text-gray-400",
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-400">{stats.total_predictions}</p>
            <p className="text-gray-500 text-sm mt-1">Total Scans</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.crop_breakdown.length}</p>
            <p className="text-gray-500 text-sm mt-1">Crop Types</p>
          </div>
          <div className="card col-span-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Top Crops</p>
            {stats.crop_breakdown.slice(0, 4).map(({ crop, cnt }) => (
              <div key={crop} className="flex items-center gap-2 mb-1">
                <span className="text-gray-300 text-sm flex-1">{crop}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full"
                    style={{ width: `${(cnt / (stats.total_predictions || 1)) * 100}%` }} />
                </div>
                <span className="text-gray-500 text-xs w-6 text-right">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-4 h-4" /> Your Scan History
          </h2>
          {history.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No scans yet. Upload a leaf photo to get started!</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelected(h)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${selected?.id === h.id ? "border-green-700 bg-green-950/30" : "border-gray-800 bg-gray-900 hover:bg-gray-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-100">{h.display_name}</p>
                      <p className="text-xs text-gray-500">{h.crop} · {new Date(h.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm font-semibold">{h.confidence?.toFixed(1)}%</p>
                      <p className={`text-xs ${SEV_COLOR[h.severity] || "text-gray-400"}`}>{h.severity}</p>
                    </div>
                  </div>
                  {h.visual_diagnosis?.[0] && (
                    <p className="text-xs text-blue-300 mt-2">Gemma: {h.visual_diagnosis[0].disease}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {!selected ? (
            <div className="h-full min-h-72 flex flex-col items-center justify-center text-gray-600 text-center">
              <History className="w-10 h-10 mb-2" />
              <p className="text-sm">Click any scan log to see the complete report.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-green-400 uppercase tracking-wide font-semibold">Complete Scan Report</p>
                  <h3 className="text-xl font-bold text-white">{selected.display_name}</h3>
                  <p className="text-sm text-gray-500">{selected.crop} · {selected.confidence.toFixed(1)}% · {selected.severity}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
              </div>

              <section className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1">Dataset Diagnosis</p>
                <p className="text-gray-300 text-sm">{selected.description || "No description stored for this older scan."}</p>
                {selected.top5?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {selected.top5.slice(0, 5).map((m, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-400">{m.class}</span>
                        <span className="text-green-400">{Number(m.confidence).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {selected.visual_diagnosis?.length > 0 && (
                <section className="border border-blue-900/70 bg-blue-950/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-2">Gemma Visual Second Opinion</p>
                  <div className="space-y-2">
                    {selected.visual_diagnosis.slice(0, 4).map((v, i) => (
                      <div key={i} className="bg-gray-900/70 rounded-lg p-2">
                        <div className="flex justify-between gap-2">
                          <p className="text-sm font-medium text-white">{i + 1}. {v.disease}</p>
                          <span className="text-xs text-blue-300">{Number(v.confidence).toFixed(0)}%</span>
                        </div>
                        <p className="text-xs text-gray-500">{v.crop_if_visible} · {v.type}</p>
                        <p className="text-xs text-gray-400 mt-1">{v.visual_reason}</p>
                        {v.immediate_action && <p className="text-xs text-green-300 mt-1">Action: {v.immediate_action}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Remedies</p>
                <ul className="space-y-1">
                  {selected.remedies?.map((r, i) => <li key={i} className="text-sm text-gray-400">• {r}</li>)}
                </ul>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Fertilizers</p>
                <ul className="space-y-1">
                  {selected.fertilizers?.map((f, i) => <li key={i} className="text-sm text-gray-400">• {f}</li>)}
                </ul>
              </section>

              {selected.prevention && (
                <section className="bg-green-950/30 border border-green-900 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-300 uppercase tracking-wide mb-1">Prevention</p>
                  <p className="text-sm text-green-100">{selected.prevention}</p>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
