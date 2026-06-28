"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { api, StatsData } from "@/lib/api";
import {
  loadScanLogs,
  logsFromStatsFallback,
  mergeScanLogs,
  scanLogsStorageKey,
  ScanLog,
} from "@/lib/scanLog";
import { Loader2, History, ChevronRight, ImageOff, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  onOpenLog: (log: ScanLog) => void;
}

function ScanThumbnail({ imageUrl }: { imageUrl: string }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [imageUrl]);

  if (!imageUrl || broken) {
    return (
      <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-5 h-5 text-gray-600" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      className="w-16 h-16 rounded-lg object-cover bg-gray-800 border border-gray-700/80 flex-shrink-0"
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export default function HistoryStats({ onOpenLog }: Props) {
  const [localLogs, setLocalLogs] = useState<ScanLog[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const local = loadScanLogs();
    let statsData: StatsData | null = null;
    let apiHistory: Awaited<ReturnType<typeof api.history>> = [];
    let statsErr: string | null = null;
    let historyErr: string | null = null;

    try {
      statsData = await api.stats();
      setStats(statsData);
    } catch (e) {
      statsErr = e instanceof Error ? e.message : "Could not load stats";
      setStats(null);
    }

    try {
      apiHistory = await api.history();
    } catch (e) {
      historyErr = e instanceof Error ? e.message : "Could not load history";
      apiHistory = [];
    }

    let merged = mergeScanLogs(local, apiHistory);
    if (merged.length === 0 && statsData && statsData.total_predictions > 0) {
      merged = logsFromStatsFallback(statsData);
    }
    setLocalLogs(merged);

    if (statsErr && historyErr && merged.length === 0) {
      setError(
        `${statsErr}. ${historyErr}. Sign out and sign in again, or retry if the server is waking up.`
      );
    } else if (historyErr && merged.length === 0 && !statsData?.total_predictions) {
      setError(historyErr);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    const onLocalUpdate = () => {
      void refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === scanLogsStorageKey() || e.key === "sa_user") {
        void refresh();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener("sa-scan-logs-updated", onLocalUpdate);
    window.addEventListener("sa-user-changed", onLocalUpdate);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("sa-scan-logs-updated", onLocalUpdate);
      window.removeEventListener("sa-user-changed", onLocalUpdate);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const displayLogs = useMemo(() => {
    return [...localLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [localLogs]);

  const SEV_COLOR: Record<string, string> = {
    High: "text-red-400", Medium: "text-yellow-400", Low: "text-green-400", None: "text-gray-400",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="card border border-amber-800/50 bg-amber-950/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-200 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                refresh().finally(() => setLoading(false));
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-green-400">{stats.total_predictions}</p>
            <p className="text-gray-500 text-sm mt-1">Total Scans</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.crop_breakdown.length}</p>
            <p className="text-gray-500 text-sm mt-1">Crop Types</p>
          </div>
          <div className="card col-span-2 lg:col-span-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Top Crops</p>
            {stats.crop_breakdown.slice(0, 3).map(({ crop, cnt }) => (
              <div key={crop} className="flex items-center gap-2 mb-1">
                <span className="text-gray-300 text-sm flex-1 truncate">{crop}</span>
                <span className="text-gray-500 text-xs">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <History className="w-4 h-4 text-green-400" /> Scan History
        </h2>
        <p className="text-xs text-gray-500 mb-4">Tap any log to reopen the full analysis on Home</p>

        {displayLogs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-12">
            {error
              ? "Could not load your scans from the server."
              : "No scans yet. Upload a leaf image on Home to get started."}
          </p>
        ) : (
          <div className="space-y-2">
            {displayLogs.map((log) => {
              const p = log.prediction;
              return (
                <button
                  key={log.id}
                  onClick={() => onOpenLog(log)}
                  className="w-full text-left rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-800/80 hover:border-green-800/50 p-3 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <ScanThumbnail imageUrl={log.imageUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-100 truncate">
                        {p.display_name_translated || p.display_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.crop} · {new Date(log.timestamp).toLocaleString()}
                      </p>
                      {log.plant?.found && (
                        <p className="text-xs text-emerald-500/80 mt-0.5 truncate">
                          Plant: {log.plant.best_match}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-green-400 text-sm font-semibold">{p.confidence.toFixed(1)}%</p>
                      <p className={`text-xs ${SEV_COLOR[p.severity] || "text-gray-400"}`}>{p.severity}</p>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 mt-1 ml-auto transition-colors" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
