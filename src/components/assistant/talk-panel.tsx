"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AssistantUIMessage } from "@/lib/ai/types";
import { useAssistant } from "./chat-provider";
import {
  canListen,
  createListener,
  speak,
  speakable,
  stopSpeaking,
  type Listener,
  type SpeechLang,
} from "./speech";

type Phase = "idle" | "listening" | "thinking" | "speaking";

function textOf(message: AssistantUIMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
}

const LANGS: { value: SpeechLang; label: string }[] = [
  { value: "en-IN", label: "EN" },
  { value: "hi-IN", label: "हिं" },
];

// Hands-free voice chat: listen until you pause, reply aloud, listen again.
export default function TalkPanel() {
  const { messages, send, statusLabel, persona, onReplyFinished } = useAssistant();
  const supported = useSyncExternalStore(() => () => {}, canListen, () => true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<SpeechLang>(persona.language);
  const [idleNote, setIdleNote] = useState(false);

  const active = useRef(false);
  const listener = useRef<Listener | null>(null);
  // Latest values for callbacks that outlive a render
  const latest = useRef({ send, lang });
  useEffect(() => {
    latest.current = { send, lang };
  });

  function listen() {
    if (!active.current) return;
    setPhase("listening");
    setHeard("");
    listener.current = createListener(latest.current.lang, {
      onText: setHeard,
      onPause: (text) => {
        listener.current = null;
        if (!active.current) return;
        if (!text) return listen();
        setPhase("thinking");
        latest.current.send(text);
      },
      onError: (message) => {
        listener.current = null;
        setError(message);
        end();
      },
      onIdle: () => {
        listener.current = null;
        setIdleNote(true);
        end();
      },
    });
  }

  function start() {
    setError(null);
    setIdleNote(false);
    active.current = true;
    listen();
  }

  function end() {
    active.current = false;
    listener.current?.abort();
    listener.current = null;
    stopSpeaking();
    setPhase("idle");
    setHeard("");
  }

  // When a reply finishes: read it aloud, then listen again
  useEffect(
    () =>
      onReplyFinished(async ({ text, isError }) => {
        if (!active.current) return;
        const reply = isError || !text ? "Sorry, something went wrong. Please try again." : text;
        setPhase("speaking");
        await speak(reply, latest.current.lang);
        if (isError) end();
        else if (active.current) listen();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once; listen/end only touch refs and setters
    [onReplyFinished],
  );

  // Stop the mic and voice when leaving Talk mode
  useEffect(
    () => () => {
      active.current = false;
      listener.current?.abort();
      stopSpeaking();
    },
    [],
  );

  function tapOrb() {
    if (phase === "idle") start();
    else if (phase === "listening") listener.current?.finish();
    else if (phase === "speaking") {
      // Interrupt and listen
      stopSpeaking();
      listen();
    }
  }

  function switchLang(next: SpeechLang) {
    setLang(next);
    latest.current.lang = next;
    if (phase === "listening") {
      listener.current?.abort();
      listener.current = null;
      listen();
    }
  }

  const turns = messages.slice(-4);
  const label =
    phase === "idle"
      ? idleNote
        ? "Paused — tap to talk again"
        : "Tap to start talking"
      : phase === "listening"
        ? heard || "Listening…"
        : phase === "thinking"
          ? (statusLabel ?? "Thinking…")
          : "Speaking… tap to interrupt";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl" aria-hidden>
              {persona.emoji}
            </span>
            <p className="font-serif text-2xl">Talk with {persona.name}</p>
            <p className="max-w-xs text-sm text-paper/55">
              Speak naturally. It waits until you finish, answers out loud, then listens again.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {turns.map((m) => {
              const text = textOf(m);
              if (!text) return null;
              return (
                <li
                  key={m.id}
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto rounded-br-md bg-ember/15"
                      : "rounded-bl-md bg-paper/[0.06]"
                  }`}
                >
                  {m.role === "user" ? text : speakable(text)}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pb-2 pt-4">
        {!supported ? (
          <p role="alert" className="text-center text-sm text-red-700 dark:text-red-300">
            Voice isn&apos;t supported in this browser. Try Chrome, Edge or Safari, or use Ask mode.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={tapOrb}
              aria-label={label}
              className="relative flex h-24 w-24 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ember/30"
            >
              <AnimatePresence>
                {(phase === "listening" || phase === "speaking") && (
                  <motion.span
                    key={phase}
                    className={`absolute inset-0 rounded-full ${
                      phase === "listening" ? "bg-red-500/25" : "bg-ember/25"
                    }`}
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0.2, 0.8] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: phase === "listening" ? 1.4 : 0.9, repeat: Infinity }}
                  />
                )}
              </AnimatePresence>
              <motion.span
                animate={phase === "thinking" ? { rotate: 360 } : { rotate: 0 }}
                transition={phase === "thinking" ? { duration: 1.6, repeat: Infinity, ease: "linear" } : {}}
                className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-colors ${
                  phase === "listening"
                    ? "bg-red-500 text-white"
                    : phase === "thinking"
                      ? "bg-[conic-gradient(var(--ember),transparent_70%)] text-ember"
                      : "bg-ember text-on-ember"
                }`}
              >
                {phase === "thinking" ? (
                  <span className="h-16 w-16 rounded-full bg-surface" />
                ) : phase === "speaking" ? (
                  <span className="flex items-end gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 rounded-full bg-current"
                        animate={{ height: [8, 22, 10, 18, 8] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                      />
                    ))}
                  </span>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                )}
              </motion.span>
            </button>

            <p
              role="status"
              aria-live="polite"
              className={`min-h-10 max-w-md text-center text-sm ${
                phase === "listening" && heard ? "text-paper" : "text-paper/55"
              }`}
            >
              {label}
            </p>
            {error && (
              <p role="alert" className="text-center text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Voice language"
                className="flex rounded-full border border-paper/10 p-0.5 text-xs"
              >
                {LANGS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={lang === l.value}
                    onClick={() => switchLang(l.value)}
                    className={`h-8 min-w-10 rounded-full px-2.5 font-semibold transition ${
                      lang === l.value ? "bg-paper/10 text-paper" : "text-paper/45"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {phase !== "idle" && (
                <button
                  type="button"
                  onClick={end}
                  className="h-9 rounded-full border border-paper/10 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                >
                  End
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
