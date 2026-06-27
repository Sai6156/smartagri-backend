"use client";
import { useState, useRef, useEffect } from "react";
import { api, ChatMsg } from "@/lib/api";
import { TTSPlayer, STTRecorder } from "@/lib/speech";
import { Send, Mic, MicOff, Volume2, Loader2, Bot, User } from "lucide-react";

interface Props { lang: string; speechLang: string; }

export default function Chatbot({ lang, speechLang }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [listening, setListening] = useState(false);
  const tts = useRef(new TTSPlayer());
  const stt = useRef(new STTRecorder());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      tts.current.speak(res.reply, speechLang);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } finally {
      setLoading(false);
    }
  }

  function startMic() {
    stt.current.start(
      speechLang,
      (text) => { setListening(false); sendMessage(text); },
      () => setListening(false),
    );
    setListening(true);
  }

  const SUGGESTIONS = ["How to prevent leaf blight?", "Best fertilizers for tomato?", "Signs of early crop disease?"];

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[70vh]">
      <div className="card flex-1 flex flex-col overflow-hidden">
        <h2 className="font-semibold text-white mb-4 flex-shrink-0">AI Farming Assistant</h2>

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
                  <button onClick={() => tts.current.speak(m.content, speechLang)}
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
          {loading && (
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
            onClick={() => listening ? stt.current.stop() : startMic()}
            className={`px-3 py-2 rounded-lg transition-colors ${
              listening ? "bg-red-600 text-white animate-pulse" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            className="btn-primary px-3">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
