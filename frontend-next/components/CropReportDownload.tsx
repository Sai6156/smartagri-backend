"use client";
import { useState } from "react";
import { ScanLog } from "@/lib/scanLog";
import { downloadScanReportPdf } from "@/lib/resolveReportPdf";
import { FileText, Download, Loader2 } from "lucide-react";

interface Props {
  log: ScanLog;
  className?: string;
}

export default function CropReportDownload({ log, className = "" }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await downloadScanReportPdf(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className={`card border-amber-900/40 bg-gradient-to-r from-amber-950/20 to-transparent ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Crop Report</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Download a professional PDF with disease analysis, treatment plan, and weather advisory.
              {log.iotData?.summary && (
                <span className="text-cyan-500/90"> Includes IoT sensor analysis.</span>
              )}
            </p>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5 flex-shrink-0"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloading ? "Generating PDF…" : "Download PDF"}
        </button>
      </div>
    </section>
  );
}
