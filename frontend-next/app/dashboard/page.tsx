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
import PageHeader from "@/components/PageHeader";
import {
  Leaf, Microscope, Cloud, BarChart2,
  FileText, AlertTriangle, Bot, LogOut, Menu, X, Sparkles, ChevronRight,
} from "lucide-react";

const PAGES = [
  { id: "detect",   label: "Disease Detector",  icon: Leaf,        subtitle: "Upload a leaf image and get instant AI-powered disease analysis." },
  { id: "plant",    label: "Plant Identifier",   icon: Microscope,  subtitle: "Identify plant species using PlantNet AI." },
  { id: "weather",  label: "Weather Monitor",    icon: Cloud,       subtitle: "Real-time weather and farming irrigation advice." },
  { id: "history",  label: "History & Stats",    icon: BarChart2,   subtitle: "View your scan history and complete reports." },
  { id: "report",   label: "AI Crop Report",     icon: FileText,    subtitle: "Generate comprehensive crop health reports." },
  { id: "risk",     label: "Risk Forecaster",    icon: AlertTriangle, subtitle: "Forecast disease risk from weather and scan data." },
  { id: "chat",     label: "AI Chatbot",         icon: Bot,         subtitle: "Ask farming questions in your language." },
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [page, setPage] = useState("detect");
  const [lang, setLang] = useState("en");
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
  const current = PAGES.find((p) => p.id === page)!;
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  function handleLogout() {
    logout();
    router.replace("/");
  }

  const PageComponent = {
    detect:  <DiseaseDetector lang={lang} speechLang={speechLang} userName={user?.name || ""} />,
    plant:   <><PageHeader title="Plant Identifier" subtitle={current.subtitle} /><PlantIdentifier lang={lang} /></>,
    weather: <><PageHeader title="Weather Monitor" subtitle={current.subtitle} /><WeatherMonitor lang={lang} speechLang={speechLang} /></>,
    history: <><PageHeader title="History & Stats" subtitle={current.subtitle} /><HistoryStats lang={lang} /></>,
    report:  <><PageHeader title="AI Crop Report" subtitle={current.subtitle} /><CropReport lang={lang} speechLang={speechLang} /></>,
    risk:    <><PageHeader title="Risk Forecaster" subtitle={current.subtitle} /><RiskForecaster lang={lang} speechLang={speechLang} /></>,
    chat:    <><PageHeader title="AI Chatbot" subtitle={current.subtitle} /><Chatbot lang={lang} speechLang={speechLang} /></>,
  }[page];

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      {sideOpen && (
        <div className="fixed inset-0 bg-black/70 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSideOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-[260px] glass-panel
        flex flex-col transition-transform duration-300
        ${sideOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Brand */}
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-base tracking-tight">SmartAgri</p>
              <p className="text-[#5a6b60] text-xs">AI Powered Agriculture</p>
            </div>
            <button onClick={() => setSideOpen(false)} className="ml-auto lg:hidden text-[#5a6b60]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSideOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                page === id
                  ? "nav-active font-medium"
                  : "text-[#7a8f82] hover:text-[#c8d4cc] hover:bg-white/3"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${page === id ? "text-green-400" : ""}`} />
              {label}
            </button>
          ))}
        </nav>

        {/* Premium */}
        <div className="px-3 pb-3">
          <div className="premium-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-green-300">Go Premium</span>
            </div>
            <p className="text-xs text-[#7a8f82] mb-3">Unlock advanced insights and priority AI analysis.</p>
            <button className="w-full flex items-center justify-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors">
              Learn more <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Sign out */}
        <div className="px-3 pb-5 border-t border-white/5 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-[#5a6b60] hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 px-5 lg:px-8 py-4 border-b border-white/5 glass-panel flex-shrink-0">
          <button onClick={() => setSideOpen(true)} className="lg:hidden text-[#7a8f82] hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <LanguageSelector value={lang} onChange={handleLangChange} />
          <div className="flex items-center gap-2.5 pl-3 border-l border-white/8">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
              <span className="online-dot absolute -bottom-0.5 -right-0.5 border-2 border-[#0c1210]" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white leading-tight">{user?.name || "Farmer"}</p>
              <p className="text-[10px] text-[#5a6b60] truncate max-w-[120px]">{user?.email}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-5 lg:px-8 py-6 lg:py-8">
          {PageComponent}
        </main>
      </div>
    </div>
  );
}
