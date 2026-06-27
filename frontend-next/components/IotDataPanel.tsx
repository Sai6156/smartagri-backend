"use client";
import { IotSensorData } from "@/lib/iotData";
import {
  Cpu,
  Droplets,
  Sprout,
  Cloud,
  Tractor,
  Radio,
  AlertTriangle,
  Wifi,
} from "lucide-react";

const GROUP_ICONS: Record<string, typeof Cpu> = {
  farm: Tractor,
  weather: Cloud,
  soil: Droplets,
  irrigation: Droplets,
  plant_health: Sprout,
  devices: Radio,
  alerts: AlertTriangle,
};

const SEV_STYLE: Record<string, string> = {
  High: "text-red-400 bg-red-950/40 border-red-900/50",
  Medium: "text-amber-400 bg-amber-950/40 border-amber-900/50",
  Low: "text-yellow-300 bg-yellow-950/30 border-yellow-900/40",
  Info: "text-cyan-300 bg-cyan-950/30 border-cyan-900/40",
};

interface Props {
  data: IotSensorData;
  compact?: boolean;
}

export default function IotDataPanel({ data, compact }: Props) {
  const groups = data.groups?.length
    ? data.groups
    : data.readings.length
      ? [{ id: "all", title: "Sensor Readings", type: "metrics" as const, readings: data.readings }]
      : [];

  if (!groups.length && !data.summary) return null;

  return (
    <div className={`space-y-4 ${compact ? "" : ""}`}>
      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.id] || Cpu;

        if (group.type === "devices" && group.devices?.length) {
          return (
            <div key={group.id}>
              <h4 className="text-xs font-semibold text-cyan-400/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {group.title}
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {group.devices.map((d) => (
                  <div
                    key={d.id}
                    className="bg-gray-900/80 rounded-xl p-3 border border-cyan-900/25 flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/50 flex items-center justify-center flex-shrink-0">
                      <Wifi className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{d.type}</p>
                      <p className="text-xs text-gray-500">{d.id}</p>
                      <div className="flex gap-3 mt-1.5 text-xs">
                        <span className={d.status === "Online" ? "text-green-400" : "text-gray-500"}>
                          {d.status}
                        </span>
                        <span className="text-gray-500">Battery {d.battery}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (group.type === "alerts" && group.alerts?.length) {
          return (
            <div key={group.id}>
              <h4 className="text-xs font-semibold text-cyan-400/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {group.title}
              </h4>
              <div className="space-y-2">
                {group.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 border text-sm ${SEV_STYLE[a.severity] || SEV_STYLE.Info}`}
                  >
                    <span className="font-semibold text-xs uppercase mr-2">{a.severity}</span>
                    {a.message}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (!group.readings.length) return null;

        return (
          <div key={group.id}>
            <h4 className="text-xs font-semibold text-cyan-400/90 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" /> {group.title}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {group.readings.map((r, i) => (
                <div
                  key={`${group.id}-${i}`}
                  className="bg-gray-900/80 rounded-xl p-3 border border-cyan-900/20"
                >
                  <p className="text-[11px] text-gray-500 leading-tight mb-1 line-clamp-2">{r.sensor}</p>
                  <p className="text-sm font-semibold text-white">
                    {r.value}
                    {r.unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{r.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
