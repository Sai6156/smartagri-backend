import { ScanLog } from "@/lib/scanLog";

/** Convert LLM markdown output into clean plain text for PDF export. */

export function stripReportMarkdown(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ReportSection {
  title: string;
  body: string;
}

/** Split plain text into titled sections (numbered headers or ALL CAPS lines). */
export function parseReportSections(text: string): ReportSection[] {
  const clean = stripReportMarkdown(text);
  const lines = clean.split("\n");
  const sections: ReportSection[] = [];
  let currentTitle = "Report";
  let bodyLines: string[] = [];

  const isSectionTitle = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    if (/^\d+[\.\)]\s+/.test(t)) return true;
    if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
    if (/^(executive summary|disease overview|immediate action|treatment|fertilizer|weather|long-term|when to consult)/i.test(t))
      return true;
    return false;
  };

  const flush = () => {
    const body = bodyLines.join("\n").trim();
    if (body) sections.push({ title: currentTitle, body });
    bodyLines = [];
  };

  for (const line of lines) {
    if (isSectionTitle(line.trim())) {
      flush();
      currentTitle = line.trim().replace(/^\d+[\.\)]\s+/, "");
    } else {
      bodyLines.push(line);
    }
  }
  flush();

  if (!sections.length && clean) {
    sections.push({ title: "Farm Advisory Report", body: clean });
  }

  return sections;
}

/** Professional plain-text report when AI generation is unavailable. */
export function buildFallbackReport(log: ScanLog): string {
  const p = log.prediction;
  const loc = log.weatherLocation || log.weather?.location || "Not specified";
  const weatherLine = log.weather
    ? `Current conditions: ${log.weather.temperature_c}°C, ${log.weather.humidity_pct}% humidity, ${log.weather.description}. ${log.weather.irrigation_advice}`
    : "Weather data not available for this scan.";

  return [
    "EXECUTIVE SUMMARY",
    "",
    `${p.display_name} was detected on ${p.crop} with ${p.confidence.toFixed(1)}% confidence. Severity: ${p.severity}. Location: ${loc}.`,
    p.description,
    "",
    "IMMEDIATE ACTION PLAN",
    "",
    ...p.remedies.map((r, i) => `${i + 1}. ${r}`),
    "",
    "FERTILIZER AND NUTRITION PLAN",
    "",
    ...p.fertilizers.map((f, i) => `${i + 1}. ${f}`),
    "",
    "PREVENTION",
    "",
    p.prevention || "Follow integrated pest management practices.",
    "",
    "WEATHER-BASED ADVISORY",
    "",
    weatherLine,
    "",
    log.riskForecast ? "RISK FORECAST\n\n" + stripReportMarkdown(log.riskForecast) : "",
  ]
    .filter(Boolean)
    .join("\n");
}
