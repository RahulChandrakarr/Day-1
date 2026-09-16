"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canListen, createListener, type Listener, type SpeechLang } from "./speech";

// Dictates into the message box; you still review and send yourself.
export default function MicButton({
  lang,
  onText,
  onError,
}: {
  lang: SpeechLang;
  onText: (text: string, done: boolean) => void;
  onError: (message: string) => void;
}) {
  const supported = useSyncExternalStore(() => () => {}, canListen, () => false);
  const [listening, setListening] = useState(false);
  const listener = useRef<Listener | null>(null);

  useEffect(() => () => listener.current?.abort(), []);

  if (!supported) return null;

  function toggle() {
    if (listener.current) {
      listener.current.finish();
      return;
    }
    setListening(true);
    listener.current = createListener(
      lang,
      {
        onText: (text) => onText(text, false),
        onPause: (text) => {
          listener.current = null;
          setListening(false);
          onText(text, true);
        },
        onError: (message) => {
          listener.current = null;
          setListening(false);
          onError(message);
        },
        onIdle: () => {
          listener.current = null;
          setListening(false);
        },
      },
      { pauseMs: 2500, idleMs: 12_000 },
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictating" : "Dictate"}
      title={listening ? "Stop" : `Speak (${lang === "hi-IN" ? "हिंदी" : "English"})`}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
        listening ? "bg-red-500 text-white" : "text-paper/55 hover:bg-paper/10 hover:text-paper"
      }`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/30" />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
