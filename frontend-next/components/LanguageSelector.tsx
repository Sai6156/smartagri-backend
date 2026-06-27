"use client";
import { useState, useEffect, useRef } from "react";
import { Globe, ChevronDown, Search } from "lucide-react";

const LANGUAGES: Record<string, string> = {
  en: "English", te: "తెలుగు", hi: "हिंदी", ta: "தமிழ்",
  kn: "ಕನ್ನಡ", ml: "മലയാളം", mr: "मराठी", bn: "বাংলা",
  gu: "ગુજરાતી", pa: "ਪੰਜਾਬੀ", or: "ଓଡ଼ିଆ", ur: "اردو",
  es: "Español", fr: "Français", pt: "Português", id: "Bahasa Indonesia",
  sw: "Kiswahili", ar: "العربية", zh: "中文", ja: "日本語",
  ko: "한국어", de: "Deutsch", it: "Italiano", ru: "Русский",
  tr: "Türkçe", vi: "Tiếng Việt", th: "ภาษาไทย", fil: "Filipino",
  ms: "Bahasa Melayu", ne: "नेपाली",
};

interface Props { value: string; onChange: (lang: string) => void; }

export default function LanguageSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = Object.entries(LANGUAGES).filter(
    ([code, name]) =>
      name.toLowerCase().includes(query.toLowerCase()) ||
      code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#c8d4cc] transition-all border border-white/8 bg-white/3 hover:border-green-500/30 hover:bg-green-500/5"
      >
        <Globe className="w-3.5 h-3.5 text-green-400" />
        <span className="font-medium hidden sm:inline">{LANGUAGES[value] || "English"}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5a6b60] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden border border-white/10">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5a6b60]" />
              <input
                autoFocus
                className="w-full bg-black/30 rounded-lg pl-8 pr-3 py-2 text-sm text-[#c8d4cc] placeholder-[#5a6b60] focus:outline-none focus:ring-1 focus:ring-green-500/50 border border-white/5"
                placeholder="Search language..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map(([code, name]) => (
              <button
                key={code}
                onClick={() => { onChange(code); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                  value === code
                    ? "text-green-400 bg-green-500/10"
                    : "text-[#c8d4cc] hover:bg-white/5"
                }`}
              >
                <span>{name}</span>
                <span className="text-xs text-[#5a6b60]">{code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
