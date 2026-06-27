"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { api, ChatMsg } from "@/lib/api";
import { VoiceListenSession, voiceTurnFromSession, speakText, stopAudio } from "@/lib/voiceApi";
import { LANGUAGES } from "@/lib/languages";
import {
  loadLastScan,
  buildScanContext,
  stripMarkdownForSpeech,
  LastScan,
} from "@/lib/scanContext";
import {
  Send, Mic, StopCircle, Volume2, Loader2, Bot, User,
  ImageIcon, X, Paperclip,
} from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function Chatbot({ lang }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [speakLang, setSpeakLang] = useState(lang);
  const [voiceError, setVoiceError] = useState("");
  const [attachedScan, setAttachedScan] = useState<LastScan | null>(null);
  const [useScanContext, setUseScanContext] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const listenRef = useRef<VoiceListenSession | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshScan = useCallback(() => {
    setAttachedScan(loadLastScan());
  }, []);

  useEffect(() => { setSpeakLang(lang); }, [lang]);

  useEffect(() => {
    refreshScan();
    window.addEventListener("sa-last-scan-updated", refreshScan);
    return () => window.removeEventListener("sa-last-scan-updated", refreshScan);
  }, [refreshScan]);

  useEffect(() => {
    listenRef.current = new VoiceListenSession();
    return () => { listenRef.current?.cancel(); stopAudio(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const scanContext = useScanContext && attachedScan
    ? buildScanContext(attachedScan)
    : "";

  async function playReply(text: string) {
    setVoiceSpeaking(true);
    try {
      await speakText(stripMarkdownForSpeech(text), speakLang);
    } finally {
      setVoiceSpeaking(false);
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const res = await api.chat(text, messages.slice(-10), scanContext, speakLang);
      const reply = stripMarkdownForSpeech(res.reply);
      const aiMsg: ChatMsg = { role: "assistant", content: reply };
      setMessages([...history, aiMsg]);
      await playReply(reply);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttach(file: File) {
    setAttaching(true);
    setVoiceError("");
    try {
      const result = await api.predict(file, lang);
      const reader = new FileReader();
      const imageUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
      const scan: LastScan = {
        result,
        imageUrl,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem("sa_last_scan", JSON.stringify(scan));
      window.dispatchEvent(new Event("sa-last-scan-updated"));
      setAttachedScan(scan);
      setUseScanContext(true);
    } catch {
      setVoiceError("Could not analyze that image. Try another leaf photo.");
    } finally {
      setAttaching(false);
    }
  }

  async function handleSpeak() {
    if (listening || processing || voiceSpeaking || loading) return;
    stopAudio();
    setVoiceError("");
    try {
      await listenRef.current!.start(speakLang);
      setListening(true);
    } catch {
      setVoiceError("Microphone access denied. Allow mic in browser settings.");
    }
  }

  async function handleStop() {
    if (voiceSpeaking) {
      stopAudio();
      setVoiceSpeaking(false);
      return;
    }
    if (!listening || !listenRef.current?.isActive) return;

    setProcessing(true);
    setVoiceError("");
    try {
      const result = await listenRef.current.stop();
      setListening(false);
      const turn = await voiceTurnFromSession(speakLang, messages, scanContext, result);
      const reply = stripMarkdownForSpeech(turn.reply);
      const userMsg: ChatMsg = { role: "user", content: turn.userText };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: reply }]);
      await playReply(reply);
    } catch (e: unknown) {
      setListening(false);
      setVoiceError(e instanceof Error ? e.message : "Voice failed");
      listenRef.current?.cancel();
    } finally {
      setProcessing(false);
    }
  }

  const SUGGESTIONS = attachedScan
    ? [
        `What treatment for ${attachedScan.result.display_name}?`,
        `Is ${attachedScan.result.severity} severity dangerous?`,
        `Best fertilizer after this disease?`,
      ]
    : [
        "How to prevent leaf blight?",
        "Best fertilizers for tomato?",
        "Signs of early crop disease?",
      ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[70vh]">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">AI Farming Assistant</h2>
            <p className="text-xs text-gray-500">Scan context auto-attached when available</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Speak in</label>
            <select
              value={speakLang}
              onChange={(e) => setSpeakLang(e.target.value)}
              disabled={listening || processing}
              className="input text-sm py-1.5"
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Attached scan banner */}
        <div className="mb-3 flex-shrink-0">
          {attachedScan && useScanContext ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-green-950/30 border border-green-800/50">
              {attachedScan.imageUrl && (
                <img
                  src={attachedScan.imageUrl}
                  alt="Attached leaf"
                  className="w-12 h-12 rounded-lg object-cover border border-green-700/50"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-400 font-medium">Leaf scan attached</p>
                <p className="text-xs text-gray-400 truncate">
                  {attachedScan.result.crop} · {attachedScan.result.display_name} ·{" "}
                  {attachedScan.result.confidence.toFixed(0)}%
                </p>
              </div>
              <button
                onClick={() => setUseScanContext(false)}
                className="text-gray-500 hover:text-gray-300 p-1"
                title="Detach scan from chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={attaching}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              >
                {attaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                Attach leaf photo
              </button>
              {attachedScan && !useScanContext && (
                <button
                  onClick={() => setUseScanContext(true)}
                  className="text-xs text-green-400 hover:underline"
                >
                  Re-attach last scan
                </button>
              )}
              {!attachedScan && (
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Or scan in Disease Detector first
                </span>
              )}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleAttach(f);
              e.target.value = "";
            }}
          />
        </div>

        {voiceError && <p className="text-red-400 text-xs mb-2">{voiceError}</p>}

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-gray-500 text-sm text-center py-4">
                {attachedScan && useScanContext
                  ? "Ask about your scanned leaf — I already know the diagnosis."
                  : "Ask me anything about farming, crops, or diseases."}
              </p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="w-full text-left text-sm px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm ${
                m.role === "user" ? "bg-green-700 text-white" : "bg-gray-800 text-gray-200"
              }`}>
                {m.content}
                {m.role === "assistant" && (
                  <button onClick={() => playReply(m.content)}
                    className="ml-2 text-gray-500 hover:text-gray-300 inline-flex">
                    <Volume2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
          ))}
          {(loading || processing) && (
            <div className="flex gap-2">
              <div className="w-7 h-7 bg-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-800 px-3 py-2 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2 flex-shrink-0 items-center">
          <button
            onClick={handleSpeak}
            disabled={listening || processing || voiceSpeaking || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium disabled:opacity-40"
          >
            <Mic className="w-4 h-4" /> Speak
          </button>
          <button
            onClick={handleStop}
            disabled={!listening && !voiceSpeaking}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
              listening || voiceSpeaking
                ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            <StopCircle className="w-4 h-4" /> Stop
          </button>
          <input
            className="input flex-1"
            placeholder={attachedScan && useScanContext ? "Ask about your scan…" : "Type your question…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          />
          <button onClick={() => sendMessage(input)} disabled={loading || processing || !input.trim()}
            className="btn-primary px-3">
            <Send className="w-4 h-4" />
          </button>
        </div>
        {(listening || voiceSpeaking) && (
          <p className="text-xs text-center mt-2 text-gray-500">
            {voiceSpeaking ? "Playing reply… tap Stop to silence" : `Listening (${LANGUAGES[speakLang]})… tap Stop when done`}
          </p>
        )}
      </div>
    </div>
  );
}
