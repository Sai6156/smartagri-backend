"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { api, PredictResult } from "@/lib/api";
import { TTSPlayer, STTRecorder } from "@/lib/speech";
import {
  Upload, Loader2, Volume2, VolumeX, Mic, MicOff,
  Play, Pause, StopCircle, MessageCircle, X, RefreshCw,
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

  // Voice conversation state
  const sttRef      = useRef<STTRecorder | null>(null);
  const [voiceActive, setVoiceActive]   = useState(false);
  const [voicePaused, setVoicePaused]   = useState(false);
  const [listening,   setListening]     = useState(false);
  const [transcript,  setTranscript]    = useState("");
  const [voiceReply,  setVoiceReply]    = useState("");
  const [voiceHistory, setVoiceHistory] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    ttsRef.current = new TTSPlayer();
    sttRef.current = new STTRecorder();
    return () => { ttsRef.current?.stop(); sttRef.current?.stop(); };
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
    if (!result) return [];
    const systemMsg = {
      role: "system" as const,
      content: `You are SmartAgri assistant. The farmer's crop analysis result: 
Disease: ${result.display_name}, Crop: ${result.crop}, 
Confidence: ${result.confidence}%, Severity: ${result.severity}.
Remedies: ${result.remedies.join(", ")}.
Answer all questions in simple language. Keep answers under 3 sentences.`,
    };
    return [systemMsg, ...voiceHistory.map(h => ({
      role: h.role as "user" | "assistant", content: h.content
    }))];
  }, [result, voiceHistory]);

  function startListening() {
    if (!sttRef.current || voicePaused) return;
    ttsRef.current?.stop();
    setListening(true);
    sttRef.current.start(
      speechLang,
      async (text) => {
        setTranscript(text);
        setListening(false);
        const newHistory = [...voiceHistory, { role: "user", content: text }];
        setVoiceHistory(newHistory);
        // Send to LLM
        try {
          const res = await api.chat(text, buildVoiceContext() as never);
          const reply = res.reply;
          setVoiceReply(reply);
          setVoiceHistory([...newHistory, { role: "assistant", content: reply }]);
          ttsRef.current?.speak(reply, speechLang, () => {
            // After TTS ends, if not paused — prompt user
            if (!voicePaused) {
              const prompt = lang === "en"
                ? "Do you have any more questions?"
                : "If you have questions, press the microphone button.";
              setTimeout(() => {
                if (!voicePaused) ttsRef.current?.speak(prompt, speechLang);
              }, 1000);
            }
          });
        } catch {
          ttsRef.current?.speak("Sorry, could not process that.", speechLang);
        }
      },
      () => setListening(false),
      (err) => { setListening(false); console.error(err); }
    );
  }

  function startVoiceConversation() {
    if (!result) return;
    setVoiceActive(true);
    setVoicePaused(false);
    setVoiceHistory([]);
    setTranscript("");
    setVoiceReply("");
    // Greet the farmer
    const greeting = lang === "en"
      ? `Hello ${userName || "Farmer"}! I've analyzed your ${result.crop} crop. I detected ${result.display_name}. Do you have any questions?`
      : `${result.display_name} detected on ${result.crop}. I'm ready to help.`;
    ttsRef.current?.speak(greeting, speechLang, () => {
      if (!voicePaused) startListening();
    });
  }

  function pauseVoice() {
    setVoicePaused(true);
    sttRef.current?.stop();
    ttsRef.current?.pause();
    setListening(false);
  }

  function resumeVoice() {
    setVoicePaused(false);
    ttsRef.current?.resume();
    const prompt = lang === "en"
      ? "I'm back. Do you have any questions?"
      : "Ready for your questions.";
    setTimeout(() => {
      ttsRef.current?.speak(prompt, speechLang, () => startListening());
    }, 500);
  }

  function endVoiceConversation() {
    setVoiceActive(false);
    setVoicePaused(false);
    sttRef.current?.stop();
    ttsRef.current?.stop();
    setListening(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Upload Leaf Image</h2>
          <label className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors min-h-52 ${
            preview ? "border-green-700 bg-green-950/20" : "border-gray-700 hover:border-gray-600 bg-gray-800/50"
          }`}>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            {preview ? (
              <img src={preview} alt="leaf" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <div className="text-center px-4">
                <Upload className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Click to upload a leaf photo</p>
                <p className="text-gray-600 text-xs mt-1">JPG, PNG, WEBP</p>
              </div>
            )}
          </label>

          {file && (
            <button
              onClick={analyze}
              disabled={loading}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Analyzing..." : "Analyze Disease"}
            </button>
          )}
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Result panel */}
        <div className="card">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-52 text-gray-600">
              <Upload className="w-10 h-10 mb-2" />
              <p className="text-sm">Upload and analyze an image to see results</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-gray-800 p-1 rounded-lg">
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
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeTab === id
                        ? "bg-green-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
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
                            <p className="text-xs text-gray-500">{v.crop_if_visible} ? {v.type}</p>
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
                          : listening
                          ? "bg-red-950/40 border border-red-800 text-red-300"
                          : "bg-green-950/40 border border-green-800 text-green-300"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          voicePaused ? "bg-yellow-400" : listening ? "bg-red-400 animate-pulse" : "bg-green-400"
                        }`} />
                        {voicePaused ? "Paused — press Resume to continue" :
                         listening    ? "Listening..." : "Ready — press mic to speak"}
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
                              onClick={startListening}
                              disabled={listening}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                                listening
                                  ? "bg-red-600 text-white animate-pulse"
                                  : "bg-green-600 hover:bg-green-500 text-white"
                              }`}
                            >
                              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                              {listening ? "Listening..." : "Speak"}
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
          )}
        </div>
      </div>
    </div>
  );
}
