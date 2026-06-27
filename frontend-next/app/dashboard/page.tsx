"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { SPEECH_LANG_MAP } from "@/lib/speech";
import LanguageSelector from "@/components/LanguageSelector";
import DiseaseDetector from "@/components/DiseaseDetector";
import PlantIdentifier from "@/components/PlantIdentifier";
import WeatherMonitor from "@/components/WeatherMonitor";
import HistoryStats from "@/components/HistoryStats";
import CropReport from "@/components/CropReport";
import RiskForecaster from "@/components/RiskForecaster";
import Chatbot from "@/components/Chatbot";
import {
  Leaf, Microscope, Cloud, BarChart2,
  FileText, AlertTriangle, Bot, LogOut, Menu, X,
} from "lucide-react";

const PAGES = [
  { id: "detect",   label: "Disease Detector",  icon: Leaf },
  { id: "plant",    label: "Plant Identifier",   icon: Microscope },
  { id: "weather",  label: "Weather Monitor",    icon: Cloud },
  { id: "history",  label: "History & Stats",    icon: BarChart2 },
  { id: "report",   label: "AI Crop Report",     icon: FileText },
  { id: "risk",     label: "Risk Forecaster",    icon: AlertTriangle },
  { id: "chat",     label: "AI Chatbot",         icon: Bot },
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser]   = useState<{ name: string; email: string } | null>(null);
  const [page, setPage]   = useState("detect");
  const [lang, setLang]   = useState("en");
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace("/"); return; }
    setUser(u);
    const saved = localStorage.getItem("sa_lang");
    if (saved) setLang(saved);
  }, [router]);

  const handleLangChange = useCallback((l: string) => {
    setLang(l);
    localStorage.setItem("sa_lang", l);
  }, []);

  const speechLang = SPEECH_LANG_MAP[lang] || "en-US";

  function handleLogout() {
    logout();
    router.replace("/");
  }

  const PageComponent = {
    detect:  <DiseaseDetector lang={lang} speechLang={speechLang} userName={user?.name || ""} />,
    plant:   <PlantIdentifier lang={lang} />,
    weather: <WeatherMonitor lang={lang} speechLang={speechLang} />,
    history: <HistoryStats lang={lang} />,
    report:  <CropReport lang={lang} speechLang={speechLang} />,
    risk:    <RiskForecaster lang={lang} speechLang={speechLang} />,
    chat:    <Chatbot lang={lang} speechLang={speechLang} />,
  }[page];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar overlay on mobile */}
      {sideOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 border-r border-gray-800
        flex flex-col transition-transform duration-200
        ${sideOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">SmartAgri</p>
            <p className="text-gray-500 text-xs truncate">{user?.name}</p>
          </div>
          <button onClick={() => setSideOpen(false)} className="ml-auto lg:hidden text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSideOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
                page === id
                  ? "bg-green-600 text-white font-medium"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <button
            onClick={() => setSideOpen(true)}
            className="lg:hidden text-gray-400 hover:text-gray-200"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-white flex-1 text-sm lg:text-base">
            {PAGES.find((p) => p.id === page)?.label}
          </h1>

          {/* Language selector — top right */}
          <LanguageSelector value={lang} onChange={handleLangChange} />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {PageComponent}
        </main>
      </div>
    </div>
  );
}
