"use client";
import { useEffect, useState } from "react";
import { api, StatsData } from "@/lib/api";
import { Activity, Bug, Image, Users } from "lucide-react";

const MINI_BARS = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88];

export default function DashboardStats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => null);
  }, []);

  const cards = [
    {
      icon: Activity,
      label: "AI Accuracy",
      value: "97.1%",
      sub: "Detection Rate",
      bars: MINI_BARS,
    },
    {
      icon: Bug,
      label: "Diseases Detected",
      value: "38+",
      sub: "Across Crops",
      bars: [30, 50, 70, 45, 80, 60, 90, 55],
    },
    {
      icon: Image,
      label: "Images Analyzed",
      value: stats ? String(stats.total_predictions) : "—",
      sub: "Your Scans",
      bars: [20, 40, 35, 60, 50, 75, 65, 85, 70, 90],
    },
    {
      icon: Users,
      label: "Farmers Helped",
      value: "10K+",
      sub: "Community",
      bars: [50, 60, 55, 70, 65, 80, 75, 90],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, label, value, sub, bars }) => (
        <div key={label} className="card !p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Icon className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-[#7a8f82] font-medium">{label}</span>
          </div>
          <p className="text-2xl font-bold text-white font-serif">{value}</p>
          <p className="text-xs text-[#5a6b60] mb-3">{sub}</p>
          <div className="flex items-end gap-0.5 h-8">
            {bars.map((h, i) => (
              <div
                key={i}
                className="stat-bar flex-1"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
