"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { textOf, useAssistant } from "./chat-provider";
import { canListen, speakable } from "./speech";
import { createTalkSession, type TalkPhase, type TalkSession } from "./talk-session";

const HOLD_TO_END_MS = 700;
const LAST_TURNS = 4;

// A long press, so a phone in a pocket can't hang up by accident.
function HoldToEnd({ onEnd }: { onEnd: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function press() {
    setHolding(true);
    timer.current = setTimeout(onEnd, HOLD_TO_END_MS);
  }
  function release() {
    setHolding(false);
    clearTimeout(timer.current);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEnd();
        }
      }}
      aria-label="End conversation"
      style={{ touchAction: "none" }}
      className="relative h-11 select-none overflow-hidden rounded-full border border-paper/15 px-5 text-sm font-semibold text-red-700 dark:text-red-300"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-red-500/25"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? `width ${HOLD_TO_END_MS}ms linear` : "none",
        }}
      />
      <span className="relative">Hold to end</span>
    </button>
  );
}

// A hands-free spoken conversation that carries on until it's ended.
export default function TalkPanel() {
  const { messages, send, persona, speakerName, onReplyFinished } = useAssistant();
  const supported = useSyncExternalStore(() => () => {}, canListen, () => true);
  const [phase, setPhase] = useState<TalkPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const session = useRef<TalkSession | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  // useChat's send changes between renders; the session outlives them
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  });

  function start() {
    setError(null);
    session.current?.end();
    session.current = createTalkSession(persona.language, {
      onPhase: setPhase,
      onError: setError,
      send: (text) => latestSend.current(text),
    });
    session.current.start();
  }

  useEffect(() => onReplyFinished((reply) => session.current?.replyFinished(reply)), [onReplyFinished]);

  // Replies are spoken as they're written, not after they're finished
  const last = messages[messages.length - 1];
  const replyId = last?.role === "assistant" ? last.id : null;
  const replyText = replyId ? textOf(last) : "";
  useEffect(() => {
    if (replyId) session.current?.replyChanged(replyId, replyText);
  }, [replyId, replyText]);

  useEffect(() => {
    const el = transcript.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Leaving Talk mode ends the conversation
  useEffect(() => () => session.current?.end(), []);

  const live = phase !== "idle";
  const label =
    phase === "idle"
      ? `Tap to talk with ${speakerName}`
      : phase === "starting"
        ? "Getting ready…"
        : phase === "listening"
          ? "Listening… just talk"
          : phase === "thinking"
            ? "Thinking…"
            : "Speaking… talk or tap to interrupt";

  const turns = messages.slice(-LAST_TURNS);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto px-1 py-4">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl" aria-hidden>
              {persona.emoji}
            </span>
            <p className="font-bold tracking-tight text-2xl">Talk with {speakerName}</p>
            <p className="max-w-xs text-sm text-paper/55">
              A real conversation in English, Hindi or both. Plug in your headphones, ask what&apos;s on
              today, interrupt whenever you like, and say &ldquo;bye&rdquo; when you&apos;re done.
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
              onClick={() => (live ? session.current?.tap() : start())}
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
                animate={phase === "thinking" || phase === "starting" ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  phase === "thinking" || phase === "starting"
                    ? { duration: 1.6, repeat: Infinity, ease: "linear" }
                    : {}
                }
                className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-colors ${
                  phase === "listening"
                    ? "bg-red-500 text-white"
                    : phase === "thinking" || phase === "starting"
                      ? "bg-[conic-gradient(var(--ember),transparent_70%)] text-ember"
                      : "bg-ember text-on-ember"
                }`}
              >
                {phase === "thinking" || phase === "starting" ? (
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

            <p role="status" aria-live="polite" className="min-h-5 max-w-md text-center text-sm text-paper/55">
              {label}
            </p>
            {error && (
              <p role="alert" className="text-center text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            {live && (
              <>
                <HoldToEnd onEnd={() => session.current?.end()} />
                <p className="max-w-xs text-center text-xs text-paper/40">
                  Keep this screen open. Locking your phone stops the microphone.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
