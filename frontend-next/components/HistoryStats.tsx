"use client";
import { useState, useEffect } from "react";
import { api, HistoryEntry, StatsData } from "@/lib/api";
import { BarChart2, Loader2, History } from "lucide-react";

interface Props { lang: string; }

export default function HistoryStats({ lang: _lang }: Props) {
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [stats, setStats]       = useState<StatsData | null>(null);
  const [loading, setLoading]   = useState(true);

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Stats cards */}
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

      {/* History table */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <History className="w-4 h-4" /> Your Scan History
        </h2>
        {history.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No scans yet. Upload a leaf photo to get started!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">Crop</th>
                  <th className="text-left py-2 pr-4">Disease</th>
                  <th className="text-left py-2 pr-4">Confidence</th>
                  <th className="text-left py-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 text-gray-500">{new Date(h.timestamp).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-gray-300">{h.crop}</td>
                    <td className="py-2 pr-4 text-gray-200">{h.display_name}</td>
                    <td className="py-2 pr-4 text-green-400">{h.confidence?.toFixed(1)}%</td>
                    <td className={`py-2 font-medium ${SEV_COLOR[h.severity] || "text-gray-400"}`}>{h.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
