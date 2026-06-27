"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { api, PredictResult } from "@/lib/api";
import { TTSPlayer } from "@/lib/speech";
import { MicRecorder, voiceTurn, speakText, stopAudio } from "@/lib/voiceApi";
import PageHeader from "@/components/PageHeader";
import DashboardStats from "@/components/DashboardStats";
import {
  Upload, Loader2, Volume2, Mic, MicOff,
  Play, Pause, StopCircle, MessageCircle, X, RefreshCw,
  ImageIcon, Scan, Zap, Target, Lightbulb,
} from "lucide-react";

interface Props { lang: string; speechLang: string; userName: string; }

const SEV_BADGE: Record<string, string> = {
  High: "badge-high", Medium: "badge-medium", Low: "badge-low", None: "badge-none",
};

export default function DiseaseDetector({ lang, speechLang, userName }: Props) {
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [result, setResult]     = useState<PredictResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [activeTab, setActiveTab] = useState<"result" | "explain" | "voice">("result");

  // TTS state
  const ttsRef    = useRef<TTSPlayer | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [paused,   setPaused]   = useState(false);

  // Explain state
  const [explanation, setExplanation]   = useState("");
  const [explainLoading, setExplainLoading] = useState(false);

  // Voice conversation state (OpenRouter STT/TTS — any language)
  const micRef        = useRef<MicRecorder | null>(null);
  const [voiceActive, setVoiceActive]   = useState(false);
  const [voicePaused, setVoicePaused]   = useState(false);
  const [listening,   setListening]     = useState(false);
  const [processing,  setProcessing]    = useState(false);
  const [voiceLang,   setVoiceLang]     = useState("");
  const [voiceLangName, setVoiceLangName] = useState("");
  const [voiceHistory, setVoiceHistory] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    ttsRef.current = new TTSPlayer();
    micRef.current = new MicRecorder();
    return () => { ttsRef.current?.stop(); micRef.current?.cancel(); stopAudio(); };
  }, []);

  function handleFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ""));
    reader.readAsDataURL(f);
    setResult(null);
    setExplanation("");
    setError("");
    setActiveTab("result");
    ttsRef.current?.stop();
    setSpeaking(false);
    setPaused(false);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const res = await api.predict(file, lang);
      setResult(res);
      if (preview) {
        localStorage.setItem("sa_last_scan", JSON.stringify({
          result: res,
          imageUrl: preview,
          timestamp: new Date().toISOString(),
        }));
        window.dispatchEvent(new Event("sa-last-scan-updated"));
      }
      setActiveTab("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── TTS for result ───────────────────────────────────────────────────
  function speakResult() {
    if (!result) return;
    const text = `${result.display_name_translated || result.display_name}. 
      Confidence ${result.confidence.toFixed(0)} percent. Severity: ${result.severity}. 
      ${result.description}. 
      Remedies: ${result.remedies.join(". ")}.`;
    ttsRef.current?.speak(text, speechLang, () => { setSpeaking(false); setPaused(false); });
    setSpeaking(true); setPaused(false);
  }

  function togglePauseTTS() {
    if (!ttsRef.current) return;
    if (paused) { ttsRef.current.resume(); setPaused(false); }
    else        { ttsRef.current.pause();  setPaused(true);  }
  }

  function stopTTS() {
    ttsRef.current?.stop(); setSpeaking(false); setPaused(false);
  }

  // ── Explain tab ──────────────────────────────────────────────────────
  async function fetchExplanation() {
    if (!result) return;
    setExplainLoading(true);
    try {
      const res = await api.explain({
        disease_name: result.display_name,
        crop: result.crop,
        confidence: result.confidence,
        severity: result.severity,
        description: result.description,
        remedies: result.remedies,
        fertilizers: result.fertilizers,
        prevention: result.prevention,
        lang,
        farmer_name: userName,
      });
      setExplanation(res.explanation);
    } catch {
      setExplanation("Could not generate explanation. Please try again.");
    } finally {
      setExplainLoading(false);
    }
  }

  function speakExplanation() {
    if (!explanation) return;
    ttsRef.current?.speak(explanation, speechLang, () => { setSpeaking(false); setPaused(false); });
    setSpeaking(true); setPaused(false);
  }

  // ── Voice Conversation ────────────────────────────────────────────────
  const buildVoiceContext = useCallback(() => {
    if (!result) return "";
    return (
      `Disease: ${result.display_name}, Crop: ${result.crop}, ` +
      `Confidence: ${result.confidence}%, Severity: ${result.severity}. ` +
      `Remedies: ${result.remedies.join(", ")}.`
    );
  }, [result]);

  async function processRecording(blob: Blob) {
    setProcessing(true);
    try {
      const turn = await voiceTurn(blob, voiceHistory, buildVoiceContext(), voiceLang || undefined, lang);
      if (!voiceLang) {
        setVoiceLang(turn.language);
        setVoiceLangName(turn.language_name);
      }
      const newHistory = [
        ...voiceHistory,
        { role: "user", content: turn.userText },
        { role: "assistant", content: turn.reply },
      ];
      setVoiceHistory(newHistory);

      if (!voicePaused) {
        await speakText(turn.reply, turn.language, () => {
          if (!voicePaused && voiceActive) startListening();
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Voice processing failed";
      if (!voicePaused) {
        const lang = voiceLang || "en";
        await speakText(msg, lang).catch(() => {});
      }
    } finally {
      setProcessing(false);
      setListening(false);
    }
  }

  async function startListening() {
    if (!micRef.current || voicePaused || processing) return;
    stopAudio();
    ttsRef.current?.stop();
    try {
      await micRef.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  async function stopListeningAndProcess() {
    if (!micRef.current?.isRecording) return;
    setListening(false);
    try {
      const blob = await micRef.current.stop();
      await processRecording(blob);
    } catch {
      setProcessing(false);
    }
  }

  async function startVoiceConversation() {
    if (!result) return;
    setVoiceActive(true);
    setVoicePaused(false);
    setVoiceHistory([]);
    setVoiceLang("");
    setVoiceLangName("");
    const greetingLang = lang;
    const greeting =
      lang === "en"
        ? `Hello ${userName || "Farmer"}! I analyzed your ${result.crop}. Ask me anything in your language.`
        : `Hello! I detected ${result.display_name} on your ${result.crop}. Speak in your language.`;
    try {
      await speakText(greeting, greetingLang, () => {
        if (!voicePaused) startListening();
      });
    } catch {
      startListening();
    }
  }

  function pauseVoice() {
    setVoicePaused(true);
    micRef.current?.cancel();
    stopAudio();
    ttsRef.current?.stop();
    setListening(false);
    setProcessing(false);
  }

  async function resumeVoice() {
    setVoicePaused(false);
    const langCode = voiceLang || lang;
    try {
      await speakText(
        langCode === "en" ? "I'm back. Ask your question." : "Ready for your question.",
        langCode,
        () => startListening()
      );
    } catch {
      startListening();
    }
  }

  function endVoiceConversation() {
    setVoiceActive(false);
    setVoicePaused(false);
    micRef.current?.cancel();
    stopAudio();
    ttsRef.current?.stop();
    setListening(false);
    setProcessing(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Disease Detector"
        subtitle="Upload a leaf image and get instant AI-powered disease analysis with visual second opinion."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Upload */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="step-badge">1</span>
            <h2 className="font-semibold text-white">Upload Leaf Image</h2>
          </div>

          <label className={`dropzone relative flex flex-col items-center justify-center cursor-pointer min-h-56 overflow-hidden ${preview ? "dropzone-active" : ""}`}>
            <input type="file" accept="image/*" className="sr-only"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            {preview ? (
              <img src={preview} alt="leaf" className="max-h-52 rounded-lg object-contain z-10" />
            ) : (
              <div className="text-center px-6 py-8 z-10">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-7 h-7 text-green-400" />
                </div>
                <p className="text-[#c8d4cc] text-sm font-medium">Drag & drop your image here</p>
                <p className="text-[#5a6b60] text-xs mt-1">or click to browse</p>
                <p className="text-[#5a6b60] text-xs mt-3">JPG, PNG, WEBP (Max 10MB)</p>
              </div>
            )}
            {!preview && (
              <div className="absolute bottom-0 right-0 w-32 h-32 opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }} />
            )}
          </label>

          <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Tips for best results</p>
            <ul className="text-xs text-[#7a8f82] space-y-1">
              <li>• Use natural daylight, avoid shadows</li>
              <li>• Focus on a single affected leaf</li>
              <li>• Keep the camera steady and close</li>
            </ul>
          </div>

          {file && (
            <button onClick={analyze} disabled={loading}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Analyzing..." : "Analyze Disease"}
            </button>
          )}
          {error && <p className="text-red-300 text-sm mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        </div>

        {/* Step 2: Analysis Preview */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="step-badge">2</span>
            <h2 className="font-semibold text-white">Analysis Preview</h2>
          </div>

          {!result && !loading ? (
            <div className="relative min-h-56 rounded-xl overflow-hidden bg-black/30 border border-white/5 flex flex-col items-center justify-center">
              <div className="scan-grid absolute inset-0 opacity-50" />
              <Scan className="w-12 h-12 text-green-500/40 mb-3 relative z-10" />
              <p className="text-[#7a8f82] text-sm relative z-10">Upload and analyze to see results</p>
              <div className="flex gap-6 mt-6 relative z-10">
                {[
                  { icon: Zap, label: "Instant Detection" },
                  { icon: Target, label: "High Accuracy" },
                  { icon: Lightbulb, label: "Smart Recommendations" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="text-center">
                    <Icon className="w-5 h-5 text-green-400/60 mx-auto mb-1" />
                    <p className="text-[10px] text-[#5a6b60]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div className="relative min-h-56 rounded-xl overflow-hidden">
              {preview && <img src={preview} alt="scanning" className="w-full h-56 object-cover opacity-60" />}
              <div className="scan-grid absolute inset-0" />
              <div className="scan-overlay absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-green-400 mx-auto mb-3" />
                  <p className="text-green-300 text-sm font-medium">AI Scanning...</p>
                </div>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Tabs */}
              <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-black/25 border border-white/5">
                {[
                  { id: "result",  label: "Result" },
                  { id: "explain", label: "Explain" },
                  { id: "voice",   label: "Voice Chat" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveTab(id as typeof activeTab);
                      if (id === "explain" && !explanation) fetchExplanation();
                    }}
                    className={`flex-1 tab-pill ${activeTab === id ? "tab-pill-active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Result tab */}
              {activeTab === "result" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-green-900/70 bg-green-950/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-2">Dataset model result we trained on</p>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-white text-lg leading-tight">
                          {result.display_name_translated || result.display_name}
                        </h3>
                        <p className="text-gray-500 text-xs mt-0.5">{result.display_name}</p>
                      </div>
                      <span className={SEV_BADGE[result.severity] || "badge-none"}>
                        {result.severity}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Crop</p>
                      <p className="font-medium text-white">{result.crop}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Confidence</p>
                      <p className="font-medium text-green-400">{result.confidence.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>

                  <p className="text-gray-400 text-sm">{result.description}</p>

                  {result.top5?.length > 0 && (
                    <div className="bg-gray-800/70 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Dataset Top Matches</p>
                      <div className="space-y-1.5">
                        {result.top5.slice(0, 5).map((m, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-gray-300 truncate">{m.class}</span>
                            <span className="text-green-400 font-medium">{Number(m.confidence).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.visual_diagnosis?.length > 0 && (
                    <div className="rounded-xl border border-blue-900/70 bg-blue-950/20 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-300 mb-2">Gemma visual second opinion (not limited to dataset)</p>
                      <div className="space-y-2">
                        {result.visual_diagnosis.slice(0, 4).map((v, i) => (
                          <div key={i} className="bg-gray-900/70 rounded-lg p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-gray-100 text-sm">{i + 1}. {v.disease}</p>
                              <span className="text-blue-300 text-xs">{Number(v.confidence).toFixed(0)}%</span>
                            </div>
                            <p className="text-xs text-[#5a6b60]">{v.crop_if_visible} · {v.type}</p>
                            <p className="text-xs text-gray-400 mt-1">{v.visual_reason}</p>
                            {v.immediate_action && <p className="text-xs text-green-300 mt-1">Action: {v.immediate_action}</p>}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2">Use this when model confidence is low or the leaf/crop is outside the training dataset.</p>
                    </div>
                  )}

                  {result.remedies.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-300 mb-1 uppercase tracking-wide">Remedies</p>
                      <ul className="space-y-1">
                        {result.remedies.map((r, i) => (
                          <li key={i} className="text-gray-400 text-sm flex gap-2">
                            <span className="text-green-500 mt-0.5">•</span>{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* TTS controls */}
                  <div className="flex gap-2 pt-1">
                    {!speaking ? (
                      <button onClick={speakResult} className="btn-secondary flex items-center gap-1.5 text-xs">
                        <Volume2 className="w-3.5 h-3.5" /> Read Aloud
                      </button>
                    ) : (
                      <>
                        <button onClick={togglePauseTTS} className="btn-secondary flex items-center gap-1.5 text-xs">
                          {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          {paused ? "Resume" : "Pause"}
                        </button>
                        <button onClick={stopTTS} className="btn-secondary flex items-center gap-1.5 text-xs">
                          <StopCircle className="w-3.5 h-3.5" /> Stop
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Explain tab */}
              {activeTab === "explain" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-300">AI Explanation in your language</p>
                    <button onClick={fetchExplanation} className="btn-secondary text-xs flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>
                  {explainLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Gemma is preparing explanation...</span>
                    </div>
                  ) : explanation ? (
                    <>
                      <div className="bg-gray-800 rounded-xl p-4 text-gray-300 text-sm leading-relaxed">
                        {explanation}
                      </div>
                      <div className="flex gap-2">
                        {!speaking ? (
                          <button onClick={speakExplanation} className="btn-secondary flex items-center gap-1.5 text-xs">
                            <Volume2 className="w-3.5 h-3.5" /> Listen
                          </button>
                        ) : (
                          <>
                            <button onClick={togglePauseTTS} className="btn-secondary flex items-center gap-1.5 text-xs">
                              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                              {paused ? "Resume" : "Pause"}
                            </button>
                            <button onClick={stopTTS} className="btn-secondary flex items-center gap-1.5 text-xs">
                              <StopCircle className="w-3.5 h-3.5" /> Stop
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-600 text-sm text-center py-8">
                      Switch to this tab after analyzing to get an explanation.
                    </p>
                  )}
                </div>
              )}

              {/* Voice tab */}
              {activeTab === "voice" && (
                <div className="space-y-4">
                  {!voiceActive ? (
                    <div className="text-center py-6">
                      <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm mb-4">
                        Start a voice conversation about this detection.<br />
                        Ask questions — I'll answer in your language.
                      </p>
                      <button
                        onClick={startVoiceConversation}
                        className="btn-primary flex items-center gap-2 mx-auto"
                      >
                        <Mic className="w-4 h-4" /> Join the Conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Status */}
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        voicePaused
                          ? "bg-yellow-950/40 border border-yellow-800 text-yellow-300"
                          : processing
                          ? "bg-blue-950/40 border border-blue-800 text-blue-300"
                          : listening
                          ? "bg-red-950/40 border border-red-800 text-red-300"
                          : "bg-green-950/40 border border-green-800 text-green-300"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          voicePaused ? "bg-yellow-400" : processing ? "bg-blue-400 animate-pulse" : listening ? "bg-red-400 animate-pulse" : "bg-green-400"
                        }`} />
                        {voicePaused ? "Paused — press Resume to continue" :
                         processing ? "Processing your speech..." :
                         listening    ? "Listening — tap mic when done" :
                         voiceLangName ? `Ready — speak in ${voiceLangName}` : "Ready — speak in any language"}
                      </div>

                      {/* Conversation history */}
                      {voiceHistory.length > 0 && (
                        <div className="bg-gray-800 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                          {voiceHistory.map((m, i) => (
                            <div key={i} className={`text-xs ${
                              m.role === "user" ? "text-blue-300" : "text-green-300"
                            }`}>
                              <span className="font-semibold">{m.role === "user" ? "You" : "AI"}:</span> {m.content}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Controls */}
                      <div className="flex gap-2 justify-center flex-wrap">
                        {!voicePaused ? (
                          <>
                            <button
                              onClick={() => listening ? stopListeningAndProcess() : startListening()}
                              disabled={processing}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                listening
                                  ? "bg-red-600 text-white animate-pulse"
                                  : processing
                                  ? "bg-gray-600 text-gray-300 cursor-wait"
                                  : "bg-green-600 hover:bg-green-500 text-white"
                              }`}
                            >
                              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              {listening ? "Stop & Send" : processing ? "Processing..." : "Speak"}
                            </button>
                            <button onClick={pauseVoice} className="btn-secondary flex items-center gap-1.5 text-sm">
                              <Pause className="w-4 h-4" /> Pause
                            </button>
                          </>
                        ) : (
                          <button onClick={resumeVoice} className="btn-primary flex items-center gap-2">
                            <Play className="w-4 h-4" /> Resume
                          </button>
                        )}
                        <button onClick={endVoiceConversation} className="btn-secondary flex items-center gap-1.5 text-sm text-red-400">
                          <X className="w-4 h-4" /> End
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <DashboardStats />
    </div>
  );
}
