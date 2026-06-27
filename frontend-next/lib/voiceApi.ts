/**
 * Voice: pick language → Speak → Stop → STT → chat → TTS in same language.
 */

import { VoiceListenSession, SPEECH_LANG_MAP, TTSPlayer } from "@/lib/speech";
import { stripMarkdownForSpeech } from "@/lib/scanContext";
import { LANGUAGES } from "@/lib/languages";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("sa_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface VoiceChatResult {
  reply: string;
  language: string;
  source: string;
}

export interface VoiceTurnResult {
  userText: string;
  reply: string;
  language: string;
  language_name: string;
  sttSource: "browser" | "openrouter";
}

export { VoiceListenSession };

let currentAudio: HTMLAudioElement | null = null;
let browserTts: TTSPlayer | null = null;
let speaking = false;

export function isSpeaking(): boolean {
  return speaking;
}

export function stopAudio(): void {
  speaking = false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  browserTts?.stop();
  browserTts = null;
}

function playAudioBlob(blob: Blob, onEnd?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    speaking = true;

    const done = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      speaking = false;
      onEnd?.();
      resolve();
    };

    audio.onended = done;
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      speaking = false;
      reject(new Error("Audio playback failed"));
    };
    audio.play().catch((e) => {
      URL.revokeObjectURL(url);
      speaking = false;
      reject(e);
    });
  });
}

function browserSpeak(text: string, language: string, onEnd?: () => void): Promise<void> {
  return new Promise((resolve) => {
    browserTts = new TTSPlayer();
    const bcp47 = SPEECH_LANG_MAP[language] || language;
    speaking = true;
    browserTts.speak(text, bcp47, () => {
      speaking = false;
      onEnd?.();
      resolve();
    });
  });
}

export async function speakText(text: string, language: string, onEnd?: () => void): Promise<void> {
  const clean = stripMarkdownForSpeech(text);
  if (!clean) return;
  stopAudio();

  try {
    const res = await fetch(`${BASE}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ text: clean, language }),
    });
    if (!res.ok) throw new Error("TTS API failed");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("audio")) throw new Error("Not audio");
    const blob = await res.blob();
    if (blob.size < 500) throw new Error("Audio too small");
    await playAudioBlob(blob, onEnd);
  } catch {
    await browserSpeak(clean, language, onEnd);
  }
}

async function transcribeBlob(blob: Blob, language: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", blob, "voice.webm");
  fd.append("language", language);
  const res = await fetch(`${BASE}/api/voice/stt`, {
    method: "POST",
    headers: authHeader(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "STT failed" }));
    throw new Error(err.detail || "STT failed");
  }
  const data = await res.json();
  return (data.text || "").trim();
}

export async function voiceChat(
  message: string,
  language: string,
  history: { role: string; content: string }[],
  context = ""
): Promise<VoiceChatResult> {
  const res = await fetch(`${BASE}/api/voice/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ message, language, history, context }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Chat failed" }));
    throw new Error(err.detail || "Chat failed");
  }
  return res.json();
}

/** Process stopped listen session → chat → return turn result. */
export async function voiceTurnFromSession(
  speakLang: string,
  history: { role: string; content: string }[],
  context: string,
  sessionResult: { text: string; blob: Blob | null }
): Promise<VoiceTurnResult> {
  let userText = sessionResult.text.trim();
  let sttSource: "browser" | "openrouter" = "browser";

  if (!userText && sessionResult.blob && sessionResult.blob.size > 500) {
    try {
      userText = await transcribeBlob(sessionResult.blob, speakLang);
      sttSource = "openrouter";
    } catch {
      /* keep empty */
    }
  }

  if (!userText) {
    throw new Error("Could not hear you. Tap Speak, talk clearly, then tap Stop.");
  }

  const chat = await voiceChat(userText, speakLang, history, context);
  return {
    userText,
    reply: chat.reply,
    language: speakLang,
    language_name: LANGUAGES[speakLang] || speakLang,
    sttSource,
  };
}
