"use client";
import { DatasetPrediction, PredictResult, VisualDiagnosis } from "@/lib/api";
import { Cpu, Sparkles } from "lucide-react";

const SEV_BADGE: Record<string, string> = {
  High: "badge-high",
  Medium: "badge-medium",
  Low: "badge-low",
  None: "badge-none",
};

function LlmBox({ item, rank }: { item: VisualDiagnosis; rank: number }) {
  return (
    <div className="aspect-square rounded-xl border border-blue-900/40 bg-gray-900/80 p-3 flex flex-col min-h-[9rem]">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] uppercase tracking-wide text-blue-400/90 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI #{rank}
        </span>
        <span className="text-xs text-blue-300 font-semibold">{item.confidence.toFixed(0)}%</span>
      </div>
      <p className="text-sm font-medium text-white leading-snug line-clamp-2">{item.disease}</p>
      <p className="text-[11px] text-gray-500 mt-1 truncate">{item.crop_if_visible}</p>
      <p className="text-[11px] text-gray-400 mt-auto line-clamp-3">{item.visual_reason}</p>
    </div>
  );
}

function DatasetBox({ dataset }: { dataset: DatasetPrediction }) {
  return (
    <div className="aspect-square rounded-xl border border-green-900/40 bg-green-950/20 p-3 flex flex-col min-h-[9rem]">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] uppercase tracking-wide text-green-400/90 flex items-center gap-1">
          <Cpu className="w-3 h-3" /> Dataset prediction
        </span>
        <span className="text-xs text-green-400 font-semibold">{dataset.confidence.toFixed(1)}%</span>
      </div>
      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
        {dataset.display_name_translated || dataset.display_name}
      </p>
      <p className="text-[11px] text-gray-500 mt-1 truncate">{dataset.crop}</p>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className={`badge text-[10px] ${SEV_BADGE[dataset.severity] || "badge-none"}`}>
          {dataset.severity}
        </span>
      </div>
    </div>
  );
}

interface Props {
  prediction: PredictResult;
}

/** Three alternate LLM picks plus one dataset model result in square tiles. */
export default function SecondaryPredictionsGrid({ prediction }: Props) {
  const alternates = (prediction.visual_diagnosis || []).slice(1, 4);
  const dataset = prediction.dataset_prediction;
  if (!alternates.length && !dataset) return null;

  return (
    <section className="card border-blue-900/30">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
        Other possibilities
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {alternates.map((item, i) => (
          <LlmBox key={`llm-${i}`} item={item} rank={i + 2} />
        ))}
        {dataset && <DatasetBox dataset={dataset} />}
      </div>
    </section>
  );
}
