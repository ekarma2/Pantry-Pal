"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Minimal Web Speech API types (not in TypeScript's DOM lib).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/**
 * Dictation via the Web Speech API. Unsupported browsers (and flaky iOS Safari)
 * fall back to the keyboard's own dictation button.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => () => rec.current?.stop(), []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onFinalRef.current(res[0].transcript.trim());
        else pending += res[0].transcript;
      }
      setInterim(pending);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone access was blocked. Try your keyboard's dictation instead.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Voice input stopped. Try again or use your keyboard's dictation.");
      }
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  function stop() {
    rec.current?.stop();
  }

  return { supported, listening, interim, error, start, stop };
}
