import { api } from "@/lib/api";
import { loadUserLocation } from "@/lib/location";
import { ScanLog } from "@/lib/scanLog";
import { buildFallbackReport, stripReportMarkdown } from "@/lib/formatReport";
import { downloadCropReportPdf } from "@/lib/cropReportPdf";

export async function downloadScanReportPdf(log: ScanLog): Promise<void> {
  let report = log.cropReport?.trim() || "";

  if (!report || report.startsWith("Report could not")) {
    const saved = loadUserLocation();
    const lat = log.lat ?? saved?.lat ?? 0;
    const lon = log.lon ?? saved?.lon ?? 0;
    const city = log.weatherLocation ?? saved?.city ?? log.weather?.location ?? "";

    if (lat && lon) {
      try {
        const p = log.prediction;
        const res = await api.generateReport({
          class_name: p.class_name,
          display_name: p.display_name,
          crop: p.crop,
          confidence: p.confidence,
          severity: p.severity,
          remedies: p.remedies,
          fertilizers: p.fertilizers,
          prevention: p.prevention,
          lat,
          lon,
          location: city,
          iot_data: log.iotData?.summary?.trim() || "",
        });
        report = res.report;
      } catch {
        report = buildFallbackReport(log);
      }
    } else {
      report = buildFallbackReport(log);
    }
  }

  downloadCropReportPdf(log, stripReportMarkdown(report));
}
