"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { canListen, createListener, type Listener } from "./speech";

type State = "off" | "starting" | "listening" | "transcribing";

// Dictates into the message box; you still review and send yourself.
export default function MicButton({
  onText,
  onError,
}: {
  onText: (text: string) => void;
  onError: (message: string) => void;
}) {
  const supported = useSyncExternalStore(() => () => {}, canListen, () => false);
  const [state, setState] = useState<State>("off");
  const listener = useRef<Listener | null>(null);

  useEffect(() => () => listener.current?.abort(), []);

  if (!supported) return null;

  function toggle() {
    if (state === "transcribing") return;
    if (listener.current) {
      listener.current.finish();
      return;
    }
    setState("starting");
    const stop = () => {
      listener.current = null;
      setState("off");
    };
    listener.current = createListener(
      {
        onReady: () => setState("listening"),
        onTranscribing: () => setState("transcribing"),
        onPause: (text) => {
          stop();
          if (text) onText(text);
        },
        onError: (message) => {
          stop();
          onError(message);
        },
        onIdle: stop,
      },
      { pauseMs: 2500, idleMs: 12_000 },
    );
  }

  const label =
    state === "listening"
      ? "Stop dictating"
      : state === "starting"
        ? "Getting the microphone ready"
        : state === "transcribing"
          ? "Writing down what you said"
          : "Dictate";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={state === "listening"}
      aria-label={label}
      title={label}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
        state === "listening"
          ? "bg-red-500 text-white"
          : state === "off"
            ? "text-paper/70 hover:bg-paper/10 hover:text-paper"
            : "bg-paper/10 text-paper"
      }`}
    >
      {state === "listening" && <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/30" />}
      {state === "starting" || state === "transcribing" ? (
        <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
