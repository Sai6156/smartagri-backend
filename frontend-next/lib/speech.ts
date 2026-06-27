/**
 * Web Speech API wrappers for TTS and STT.
 * Natively supports 140+ languages — no API key needed.
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
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export class STTRecorder {
  private recognition: SpeechRecognitionInstance | null = null;
  private _isListening = false;

  start(
    lang: string,
    onResult: (text: string) => void,
    onEnd: () => void,
    onError?: (err: string) => void
  ): void {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SR) {
      onError?.("Speech recognition not supported in this browser.");
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = lang;
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
    this._isListening = false;
  }

  get isListening(): boolean {
    return this._isListening;
  }

  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window ||
        "webkitSpeechRecognition" in window)
    );
  }
}

// ── Language code mapping (lang code → BCP-47 for Web Speech API) ─────────
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
