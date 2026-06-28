"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, saveUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { SPEECH_LANG_MAP } from "@/lib/speech";
import { ScanLog, syncScanLogsFromServer } from "@/lib/scanLog";
import LanguageSelector from "@/components/LanguageSelector";
import HomeHub from "@/components/HomeHub";
import HistoryStats from "@/components/HistoryStats";
import Chatbot from "@/components/Chatbot";
import PageHeader from "@/components/PageHeader";
import {
  Leaf, BarChart2, Bot, LogOut, Menu, X, Home,
} from "lucide-react";

const PAGES = [
  { id: "home",    label: "Home",             icon: Home,       subtitle: "Upload a leaf image for full AI analysis." },
  { id: "history", label: "History & Stats",  icon: BarChart2,  subtitle: "Your past scans and farming statistics." },
  { id: "chat",    label: "AI Chatbot",       icon: Bot,        subtitle: "Ask farming questions in your language." },
] as const;

type PageId = (typeof PAGES)[number]["id"];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [lang, setLang] = useState("en");
  const [sideOpen, setSideOpen] = useState(false);
  const [loadedLog, setLoadedLog] = useState<ScanLog | null>(null);

  useEffect(() => {
    const local = getUser();
    if (!local?.token) {
      router.replace("/");
      return;
    }
    api.auth
      .me()
      .then(async (profile) => {
        saveUser({ ...local, ...profile, token: local.token });
        setUser(profile);
        const saved = localStorage.getItem("sa_lang");
        if (saved) setLang(saved);
        await syncScanLogsFromServer();
      })
      .catch(() => {
        logout();
        router.replace("/");
      });
  }, [router]);

  useEffect(() => {
    const onAuthExpired = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      sessionStorage.setItem("sa_auth_message", detail || "Session expired. Please sign in again.");
      logout();
      router.replace("/");
    };
    window.addEventListener("sa-auth-expired", onAuthExpired);
    return () => window.removeEventListener("sa-auth-expired", onAuthExpired);
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

  function openLogFromHistory(log: ScanLog) {
    setLoadedLog(log);
    setPage("home");
    setSideOpen(false);
  }

  function clearLoadedLog() {
    setLoadedLog(null);
  }

  const PageComponent = {
    home: (
      <HomeHub
        lang={lang}
        loadedLog={loadedLog}
        onNewScan={clearLoadedLog}
      />
    ),
    history: (
      <>
        <PageHeader title="History & Stats" subtitle={current.subtitle} />
        <HistoryStats onOpenLog={openLogFromHistory} />
      </>
    ),
    chat: (
      <>
        <PageHeader title="AI Chatbot" subtitle={current.subtitle} />
        <Chatbot lang={lang} speechLang={speechLang} />
      </>
    ),
  }[page];

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      {sideOpen && (
        <div className="fixed inset-0 bg-black/70 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSideOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-[240px] glass-panel
        flex flex-col transition-transform duration-300
        ${sideOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
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

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSideOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all ${
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

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center gap-4 px-5 lg:px-8 py-4 border-b border-white/5 glass-panel flex-shrink-0">
          <button onClick={() => setSideOpen(true)} className="lg:hidden text-[#7a8f82] hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 lg:hidden">
            <p className="text-sm font-medium text-white">{current.label}</p>
          </div>
          <div className="flex-1 hidden lg:block" />
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

        <main className="flex-1 overflow-y-auto px-5 lg:px-8 py-6 lg:py-8">
          {PageComponent}
        </main>
      </div>
    </div>
  );
}
