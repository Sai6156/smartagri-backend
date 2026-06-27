import { jsPDF } from "jspdf";
import { ScanLog } from "@/lib/scanLog";
import { parseReportSections, stripReportMarkdown } from "@/lib/formatReport";

const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 5.5;

function addWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * LINE_H;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

export function downloadCropReportPdf(log: ScanLog, reportText: string): void {
  if (!reportText?.trim()) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const p = log.prediction;
  const dateStr = new Date(log.timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let y = MARGIN;

  // Header bar
  doc.setFillColor(22, 101, 52);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SmartAgri", MARGIN, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Crop Health Advisory Report", MARGIN, 20);

  y = 38;
  doc.setTextColor(30, 30, 30);

  // Summary block
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(MARGIN, y - 4, CONTENT_W, 32, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(p.display_name_translated || p.display_name, MARGIN + 4, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  y = addWrapped(
    doc,
    [
      `Crop: ${p.crop}`,
      `Confidence: ${p.confidence.toFixed(1)}%  |  Severity: ${p.severity}`,
      `Location: ${log.weatherLocation || log.weather?.location || "Not specified"}`,
      `Report date: ${dateStr}`,
    ].join("\n"),
    MARGIN + 4,
    y + 10,
    CONTENT_W - 8,
    9
  );
  y += 8;
  doc.setTextColor(30, 30, 30);

  const sections = parseReportSections(reportText);

  for (const section of sections) {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(22, 101, 52);
    y = addWrapped(doc, section.title.toUpperCase(), MARGIN, y, CONTENT_W, 11);
    y += 2;

    y = ensureSpace(doc, y, 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const body = stripReportMarkdown(section.body);
    y = addWrapped(doc, body, MARGIN, y, CONTENT_W, 10);
    y += 6;
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `SmartAgri — AI Powered Agriculture  |  Page ${i} of ${pages}`,
      MARGIN,
      290
    );
    doc.text("This report is AI-generated. Consult a local agronomist for critical decisions.", MARGIN, 294);
  }

  const slug = (p.display_name || "report").replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  doc.save(`SmartAgri-Report-${slug}-${dateStr.replace(/\s/g, "-")}.pdf`);
}
