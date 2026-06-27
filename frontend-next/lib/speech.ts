/**
 * Web Speech API wrappers for TTS and STT.
 */

// ── Text-to-Speech ────────────────────────────────────────────────────────
export class TTSPlayer {
  private utterance: SpeechSynthesisUtterance | null = null;
  private paused = false;

  speak(text: string, lang: string, onEnd?: () => void): void {
    this.stop();
    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = lang;
    this.utterance.rate = 0.9;
    this.utterance.pitch = 1.0;
    if (onEnd) this.utterance.onend = onEnd;
    this.paused = false;
    window.speechSynthesis.speak(this.utterance);
  }

  pause(): void {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.paused = true;
    }
  }

  resume(): void {
    if (this.paused) {
      window.speechSynthesis.resume();
      this.paused = false;
    }
  }

  stop(): void {
    window.speechSynthesis.cancel();
    this.paused = false;
  }

  get isSpeaking(): boolean {
    return window.speechSynthesis.speaking && !this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }
}

// ── Speech-to-Text ────────────────────────────────────────────────────────
type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export class STTRecorder {
  private recognition: SpeechRecognitionInstance | null = null;
  private _isListening = false;

  start(
    lang: string,
    onResult: (text: string) => void,
    onEnd: () => void,
    onError?: (err: string) => void
  ): void {
    const SR = getSpeechRecognition();
    if (!SR) {
      onError?.("Speech recognition not supported in this browser.");
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = lang;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    this.recognition.onend = () => {
      this._isListening = false;
      onEnd();
    };
    this.recognition.onerror = (e) => {
      this._isListening = false;
      onError?.(e.error);
    };

    this._isListening = true;
    this.recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }

  get isListening(): boolean {
    return this._isListening;
  }

  static isSupported(): boolean {
    return getSpeechRecognition() !== null;
  }
}

/**
 * Speak → Stop session: records mic audio AND runs browser STT in parallel.
 * On stop, returns browser transcript; audio blob is backup for server STT.
 */
export class VoiceListenSession {
  private recognition: SpeechRecognitionInstance | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private transcript = "";
  private _active = false;
  private stopping = false;
  private stopResolve: ((r: { text: string; blob: Blob | null }) => void) | null = null;
  private stopReject: ((e: Error) => void) | null = null;
  private delivered = false;
  private stopTimeout: ReturnType<typeof setTimeout> | null = null;

  get isActive() {
    return this._active;
  }

  async start(speakLang: string): Promise<void> {
    if (this._active) this.cancel();

    const bcp47 = SPEECH_LANG_MAP[speakLang] || speakLang;
    this.transcript = "";
    this.chunks = [];
    this.stopping = false;
    this.delivered = false;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(200);

    const SR = getSpeechRecognition();
    if (SR) {
      this.recognition = new SR();
      this.recognition.lang = bcp47;
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        if (text.trim()) this.transcript = text.trim();
      };

      this.recognition.onerror = (e) => {
        if (e.error === "aborted" || e.error === "no-speech") return;
        if (this.stopping) return;
        this._finish(new Error(e.error || "Speech recognition failed"));
      };

      this.recognition.onend = () => {
        if (this.stopping) {
          this._deliver();
        } else if (this._active && this.recognition) {
          try { this.recognition.start(); } catch { /* session ending */ }
        }
      };

      try {
        this.recognition.start();
      } catch {
        this.recognition = null;
      }
    }

    this._active = true;
  }

  stop(): Promise<{ text: string; blob: Blob | null }> {
    return new Promise((resolve, reject) => {
      if (!this._active) {
        return reject(new Error("Not listening"));
      }
      this.stopping = true;
      this.stopResolve = resolve;
      this.stopReject = reject;

      this.stopTimeout = setTimeout(() => {
        if (this.stopping) this._deliver();
      }, 4000);

      if (this.recognition) {
        try { this.recognition.stop(); } catch { this._deliver(); }
      } else {
        this._deliver();
      }
    });
  }

  cancel(): void {
    this.stopping = true;
    try { this.recognition?.abort(); } catch { /* ignore */ }
    this.recognition = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this._active = false;
    this.stopResolve = null;
    this.stopReject = null;
  }

  private _finish(err: Error): void {
    this.cancel();
    this.stopReject?.(err);
  }

  private _deliver(): void {
    if (this.delivered) return;
    this.delivered = true;
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    const resolve = this.stopResolve;
    const reject = this.stopReject;
    this.stopResolve = null;
    this.stopReject = null;

    const finish = (blob: Blob | null) => {
      this.recognition = null;
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.recorder = null;
      this._active = false;
      const text = this.transcript.trim();
      if (text) resolve?.({ text, blob });
      else reject?.(new Error("No speech detected. Speak clearly, then tap Stop."));
    };

    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = () => {
        const blob = this.chunks.length
          ? new Blob(this.chunks, { type: "audio/webm" })
          : null;
        finish(blob);
      };
      try { this.recorder.stop(); } catch { finish(null); }
    } else {
      finish(this.chunks.length ? new Blob(this.chunks, { type: "audio/webm" }) : null);
    }
  }
}

export const SPEECH_LANG_MAP: Record<string, string> = {
  en: "en-US", te: "te-IN", hi: "hi-IN", ta: "ta-IN",
  kn: "kn-IN", ml: "ml-IN", mr: "mr-IN", bn: "bn-IN",
  gu: "gu-IN", pa: "pa-IN", ur: "ur-PK", es: "es-ES",
  fr: "fr-FR", pt: "pt-BR", id: "id-ID", sw: "sw-KE",
  ar: "ar-SA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR",
  de: "de-DE", it: "it-IT", ru: "ru-RU", tr: "tr-TR",
  vi: "vi-VN", th: "th-TH", fil: "fil-PH", ms: "ms-MY",
  ne: "ne-NP", or: "or-IN",
};
