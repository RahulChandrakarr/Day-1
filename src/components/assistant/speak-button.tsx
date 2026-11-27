"use client";

import { useSyncExternalStore } from "react";
import { canSpeak, speak, speakingStore, stopSpeaking, type SpeechLang } from "./speech";

// Reads one reply aloud; tap again to stop.
export default function SpeakButton({
  id,
  text,
  lang,
}: {
  id: string;
  text: string;
  lang: SpeechLang;
}) {
  const speaking = useSyncExternalStore(speakingStore.subscribe, speakingStore.get, () => null);
  const supported = useSyncExternalStore(
    () => () => {},
    canSpeak,
    () => false,
  );
  if (!supported) return null;
  const active = speaking === id;

  return (
    <button
      type="button"
      onClick={() => (active ? stopSpeaking() : void speak(text, lang, id))}
      aria-label={active ? "Stop reading" : "Read aloud"}
      title={active ? "Stop" : "Read aloud"}
      className={`mt-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition ${
        active ? "bg-ember/15 text-ember" : "text-paper/60 hover:bg-paper/5 hover:text-paper"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H2v6h4l5 4z" />
        {active ? (
          <path d="M16 9v6M20 9v6" />
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        )}
      </svg>
      {active ? "Stop" : "Listen"}
    </button>
  );
}
