/**
 * OpenRouter-powered voice: record → STT → chat → TTS
 * Input and output stay in the same auto-detected language.
 * Falls back to browser speech recognition if OpenRouter STT credits are low.
 */

import { STTRecorder, SPEECH_LANG_MAP, TTSPlayer } from "@/lib/speech";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("sa_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface STTResult {
  text: string;
  language: string;
  language_name: string;
  error?: string;
}

export interface VoiceChatResult {
  reply: string;
  language: string;
  source: string;
}

/** Record microphone audio in the browser */
export class MicRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private _recording = false;

  get isRecording() {
    return this._recording;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this._recording = true;
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) return reject(new Error("Not recording"));
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.stream?.getTracks().forEach((t) => t.stop());
        this._recording = false;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  cancel(): void {
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this._recording = false;
  }
}

/** Play MP3 audio blob */
export function playAudioBlob(blob: Blob, onEnd?: () => void): HTMLAudioElement {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => {
    URL.revokeObjectURL(url);
    onEnd?.();
  };
  audio.play().catch(() => onEnd?.());
  return audio;
}

let currentAudio: HTMLAudioElement | null = null;
let browserTts: TTSPlayer | null = null;

export function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  browserTts?.stop();
  browserTts = null;
}

function browserSpeak(text: string, language: string, onEnd?: () => void): void {
  browserTts = new TTSPlayer();
  const bcp47 = SPEECH_LANG_MAP[language] || language;
  browserTts.speak(text, bcp47, onEnd);
}

export async function speakText(text: string, language: string, onEnd?: () => void): Promise<void> {
  stopAudio();
  try {
    const res = await fetch(`${BASE}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error("TTS API failed");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("audio")) throw new Error("TTS returned non-audio response");
    const blob = await res.blob();
    if (blob.size < 500) throw new Error("TTS audio too short");
    currentAudio = playAudioBlob(blob, onEnd);
  } catch {
    browserSpeak(text, language, onEnd);
  }
}

export async function transcribeAudio(blob: Blob): Promise<STTResult> {
  const fd = new FormData();
  fd.append("file", blob, "voice.webm");
  const res = await fetch(`${BASE}/api/voice/stt`, {
    method: "POST",
    headers: authHeader(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "STT failed" }));
    throw new Error(err.detail || "STT failed");
  }
  return res.json();
}

export async function detectLanguage(text: string): Promise<{ language: string; language_name: string }> {
  const res = await fetch(`${BASE}/api/voice/detect-lang`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { language: "en", language_name: "English" };
  return res.json();
}

/** Browser speech recognition fallback (any language the browser supports). */
export function browserListenOnce(hintLang = ""): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!STTRecorder.isSupported()) {
      reject(new Error("Speech recognition not supported in this browser."));
      return;
    }
    const stt = new STTRecorder();
    const code = hintLang || (typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en");
    const bcp47 = SPEECH_LANG_MAP[code] || navigator.language || "en-US";
    stt.start(
      bcp47,
      (text) => resolve(text),
      () => reject(new Error("No speech detected.")),
      (err) => reject(new Error(err || "Speech recognition failed."))
    );
  });
}

function isSttCreditError(msg: string): boolean {
  return /balance|credit|\$0\.50/i.test(msg);
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

/** Full voice turn: record → STT → chat → TTS */
export async function voiceTurn(
  audioBlob: Blob,
  history: { role: string; content: string }[],
  context: string,
  knownLang?: string,
  browserLangHint = ""
): Promise<{
  userText: string;
  reply: string;
  language: string;
  language_name: string;
  sttSource: "openrouter" | "browser";
}> {
  let userText = "";
  let lang = knownLang || "";
  let language_name = "";
  let sttSource: "openrouter" | "browser" = "openrouter";

  try {
    const stt = await transcribeAudio(audioBlob);
    if (!stt.text) throw new Error(stt.error || "Could not understand speech. Try again.");
    userText = stt.text;
    lang = knownLang || stt.language || "en";
    language_name = stt.language_name;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isSttCreditError(msg)) throw e;
    userText = await browserListenOnce(browserLangHint);
    const detected = await detectLanguage(userText);
    lang = knownLang || detected.language || "en";
    language_name = detected.language_name;
    sttSource = "browser";
  }

  const chat = await voiceChat(userText, lang, history, context);

  return {
    userText,
    reply: chat.reply,
    language: lang,
    language_name: language_name || lang,
    sttSource,
  };
}
