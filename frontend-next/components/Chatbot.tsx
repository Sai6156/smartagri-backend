"use client";
import { useState, useRef, useEffect } from "react";
import { api, ChatMsg } from "@/lib/api";
import { BrowserMicSession, voiceTurnBrowser, speakText, stopAudio } from "@/lib/voiceApi";
import { LANGUAGES } from "@/lib/languages";
import { Send, Mic, StopCircle, Volume2, Loader2, Bot, User } from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function Chatbot({ lang, speechLang }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [speakLang, setSpeakLang] = useState(lang);
  const [voiceError, setVoiceError] = useState("");
  const browserMic = useRef<BrowserMicSession | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSpeakLang(lang); }, [lang]);

  useEffect(() => {
    browserMic.current = new BrowserMicSession();
    return () => { browserMic.current?.cancel(); stopAudio(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function playReply(text: string) {
    setVoiceSpeaking(true);
    try {
      await speakText(text, speakLang);
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
      const res = await api.chat(text, messages.slice(-10));
      const aiMsg: ChatMsg = { role: "assistant", content: res.reply };
      setMessages([...history, aiMsg]);
      await playReply(res.reply);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSpeak() {
    if (listening || processing || voiceSpeaking || loading) return;
    stopAudio();
    setVoiceError("");
    try {
      browserMic.current?.start(speakLang);
      setListening(true);
    } catch (e: unknown) {
      setVoiceError(e instanceof Error ? e.message : "Mic not available");
    }
  }

  async function handleStop() {
    if (voiceSpeaking) {
      stopAudio();
      setVoiceSpeaking(false);
      return;
    }
    if (!listening || !browserMic.current?.isListening) return;

    setListening(false);
    setProcessing(true);
    setVoiceError("");
    try {
      const turn = await voiceTurnBrowser(
        speakLang,
        messages,
        "",
        () => browserMic.current!.stop()
      );
      const userMsg: ChatMsg = { role: "user", content: turn.userText };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      await playReply(turn.reply);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Voice failed";
      setVoiceError(msg);
    } finally {
      setProcessing(false);
    }
  }

  const SUGGESTIONS = ["How to prevent leaf blight?", "Best fertilizers for tomato?", "Signs of early crop disease?"];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[70vh]">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">AI Farming Assistant</h2>
            <p className="text-xs text-gray-500">Speak → Stop to ask by voice</p>
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

        {voiceError && <p className="text-red-400 text-xs mb-2">{voiceError}</p>}

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-gray-500 text-sm text-center py-4">Ask me anything about farming, crops, or diseases.</p>
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
            title="Start speaking"
          >
            <Mic className="w-4 h-4" /> Speak
          </button>
          <button
            onClick={handleStop}
            disabled={!listening && !voiceSpeaking}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
              listening || voiceSpeaking
                ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                : "bg-gray-700 text-gray-500"
            }`}
            title={voiceSpeaking ? "Stop audio" : "Stop and send"}
          >
            <StopCircle className="w-4 h-4" />
            {voiceSpeaking ? "Stop" : "Stop"}
          </button>
          <input
            className="input flex-1"
            placeholder="Or type your question..."
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
            {voiceSpeaking ? "Playing reply…" : `Listening in ${LANGUAGES[speakLang]}…`}
          </p>
        )}
      </div>
    </div>
  );
}
