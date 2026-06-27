/**
 * Voice: user picks speak language → STT → Gemma chat → TTS in same language.
 */

import { STTRecorder, SPEECH_LANG_MAP, TTSPlayer } from "@/lib/speech";
import { LANGUAGES } from "@/lib/languages";

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

export interface VoiceTurnResult {
  userText: string;
  reply: string;
  language: string;
  language_name: string;
  sttSource: "openrouter" | "browser";
}

/** Live mic recorder (Speak → Stop sends audio blob). */
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
    this.recorder.start(250);
    this._recording = true;
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.recorder || !this._recording) {
        return reject(new Error("Not recording"));
      }
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.recorder = null;
        this._recording = false;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  cancel(): void {
    if (this.recorder && this._recording) {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this._recording = false;
  }
}

/** Browser speech recognition with manual Stop (Speak → Stop). */
export class BrowserMicSession {
  private stt: STTRecorder | null = null;
  private transcript = "";
  private _listening = false;
  private resolveStop: ((text: string) => void) | null = null;
  private rejectStop: ((err: Error) => void) | null = null;

  get isListening() {
    return this._listening;
  }

  start(speakLang: string): void {
    if (!STTRecorder.isSupported()) {
      throw new Error("Speech recognition not supported. Use Chrome or Edge.");
    }
    this.transcript = "";
    this.stt = new STTRecorder();
    const bcp47 = SPEECH_LANG_MAP[speakLang] || speakLang;
    this._listening = true;

    this.stt.start(
      bcp47,
      (text) => { this.transcript = text; },
      () => {
        this._listening = false;
        if (this.resolveStop) {
          const t = this.transcript.trim();
          if (t) this.resolveStop(t);
          else this.rejectStop?.(new Error("No speech detected. Tap Speak and try again."));
          this.resolveStop = null;
          this.rejectStop = null;
        }
      },
      (err) => {
        this._listening = false;
        this.rejectStop?.(new Error(err || "Speech recognition failed"));
        this.resolveStop = null;
        this.rejectStop = null;
      }
    );
  }

  stop(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this._listening || !this.stt) {
        return reject(new Error("Not listening"));
      }
      this.resolveStop = resolve;
      this.rejectStop = reject;
      this.stt.stop();
    });
  }

  cancel(): void {
    this.stt?.stop();
    this.stt = null;
    this._listening = false;
    this.resolveStop = null;
    this.rejectStop = null;
    this.transcript = "";
  }
}

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

/** Speak reply text in the selected language. Server gTTS first, browser fallback. */
export async function speakText(text: string, language: string, onEnd?: () => void): Promise<void> {
  if (!text.trim()) return;
  stopAudio();

  try {
    const res = await fetch(`${BASE}/api/voice/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) throw new Error("TTS API failed");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("audio")) throw new Error("Not audio");
    const blob = await res.blob();
    if (blob.size < 500) throw new Error("Audio too small");
    await playAudioBlob(blob, onEnd);
  } catch {
    await browserSpeak(text, language, onEnd);
  }
}

export async function transcribeAudio(blob: Blob, language?: string): Promise<STTResult> {
  const fd = new FormData();
  fd.append("file", blob, "voice.webm");
  if (language) fd.append("language", language);
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

function isSttCreditError(msg: string): boolean {
  return /balance|credit|\$0\.50/i.test(msg);
}

/** Browser STT using user-selected language (primary — reliable). */
export async function voiceTurnBrowser(
  speakLang: string,
  history: { role: string; content: string }[],
  context: string,
  getTranscript: () => Promise<string>
): Promise<VoiceTurnResult> {
  const userText = (await getTranscript()).trim();
  if (!userText) throw new Error("No speech detected.");

  const chat = await voiceChat(userText, speakLang, history, context);
  return {
    userText,
    reply: chat.reply,
    language: speakLang,
    language_name: LANGUAGES[speakLang] || speakLang,
    sttSource: "browser",
  };
}

/** Recorded audio → OpenRouter STT, fallback browser transcript fn. */
export async function voiceTurnRecorded(
  blob: Blob,
  speakLang: string,
  history: { role: string; content: string }[],
  context: string,
  browserFallback: () => Promise<string>
): Promise<VoiceTurnResult> {
  let userText = "";
  let sttSource: "openrouter" | "browser" = "openrouter";

  try {
    const stt = await transcribeAudio(blob, speakLang);
    if (!stt.text) throw new Error(stt.error || "Could not understand speech.");
    userText = stt.text;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isSttCreditError(msg)) throw e;
    userText = await browserFallback();
    sttSource = "browser";
  }

  if (!userText.trim()) throw new Error("No speech detected.");

  const chat = await voiceChat(userText, speakLang, history, context);
  return {
    userText,
    reply: chat.reply,
    language: speakLang,
    language_name: LANGUAGES[speakLang] || speakLang,
    sttSource,
  };
}
