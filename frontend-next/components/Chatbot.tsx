"use client";
import { useState, useRef, useEffect } from "react";
import { api, ChatMsg } from "@/lib/api";
import { MicRecorder, voiceTurn, speakText, stopAudio } from "@/lib/voiceApi";
import { Send, Mic, MicOff, Volume2, Loader2, Bot, User } from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function Chatbot({ lang, speechLang }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceLang, setVoiceLang] = useState("");
  const mic = useRef<MicRecorder | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mic.current = new MicRecorder();
    return () => { mic.current?.cancel(); stopAudio(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(text: string, detectedLang?: string) {
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
      const ttsLang = detectedLang || voiceLang || speechLang || lang;
      await speakText(res.reply, ttsLang);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
    }
  }

  async function startMic() {
    if (!mic.current) return;
    stopAudio();
    try {
      await mic.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  async function stopMicAndSend() {
    if (!mic.current?.isRecording) return;
    setListening(false);
    setProcessing(true);
    try {
      const blob = await mic.current.stop();
      const turn = await voiceTurn(blob, messages, "", voiceLang || undefined, lang);
      if (!voiceLang) setVoiceLang(turn.language);
      const userMsg: ChatMsg = { role: "user", content: turn.userText };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: turn.reply }]);
      await speakText(turn.reply, turn.language);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Voice failed";
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setProcessing(false);
    }
  }

  function toggleMic() {
    if (listening) stopMicAndSend();
    else if (!processing) startMic();
  }

  async function speakMessage(text: string) {
    const ttsLang = voiceLang || speechLang || lang;
    await speakText(text, ttsLang);
  }

  const SUGGESTIONS = ["How to prevent leaf blight?", "Best fertilizers for tomato?", "Signs of early crop disease?"];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[70vh]">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <h2 className="font-semibold text-white mb-1 flex-shrink-0">AI Farming Assistant</h2>
        <p className="text-xs text-gray-500 mb-4 flex-shrink-0">
          Voice: speak in any language — replies match your language
        </p>

        {/* Messages */}
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
                m.role === "user"
                  ? "bg-green-700 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}>
                {m.content}
                {m.role === "assistant" && (
                  <button onClick={() => speakMessage(m.content)}
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

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <input
            className="input flex-1"
            placeholder="Ask about farming..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          />
          <button
            onClick={toggleMic}
            disabled={processing || loading}
            className={`px-3 py-2 rounded-lg transition-colors ${
              listening ? "bg-red-600 text-white animate-pulse" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={() => sendMessage(input)} disabled={loading || processing || !input.trim()}
            className="btn-primary px-3">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
