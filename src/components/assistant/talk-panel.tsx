"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { textOf, useAssistant } from "./chat-provider";
import { canListen, speakable } from "./speech";
import TalkOrb from "./talk-orb";
import { createTalkSession, type TalkPhase, type TalkSession } from "./talk-session";
import { WorkingStatus } from "./working-mark";

const HOLD_TO_END_MS = 700;
const LAST_TURNS = 30;

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
  const { messages, send, persona, speakerName, onReplyFinished, status, statusLabel } =
    useAssistant();
  const supported = useSyncExternalStore(() => () => {}, canListen, () => true);
  const [phase, setPhase] = useState<TalkPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const session = useRef<TalkSession | null>(null);
  const stick = useStickToBottom(true);

  // useChat's send changes between renders; the session outlives them
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  });

  const start = useCallback(() => {
    setError(null);
    session.current?.end();
    session.current = createTalkSession(persona.language, {
      onPhase: setPhase,
      onError: setError,
      send: (text) => {
        stick.follow();
        latestSend.current(text);
      },
    });
    session.current.start();
  }, [persona.language, stick.follow]);

  useEffect(() => onReplyFinished((reply) => session.current?.replyFinished(reply)), [onReplyFinished]);

  // Replies are spoken as they're written, not after they're finished
  const last = messages[messages.length - 1];
  const replyId = last?.role === "assistant" ? last.id : null;
  const replyText = replyId ? textOf(last) : "";
  useEffect(() => {
    if (replyId) session.current?.replyChanged(replyId, replyText);
  }, [replyId, replyText]);

  const live = phase !== "idle";
  const working = status === "submitted" || status === "streaming";
  const job = statusLabel?.trim() || "Working on it…";
  const label = talkLabel(phase, speakerName, working, job);

  useEffect(() => {
    stick.pin();
  }, [stick.pin, messages, replyText, phase, working, job]);

  // Start the call as soon as Talk opens, then keep it going until they hang up.
  useEffect(() => {
    if (!supported) return;
    start();
    return () => session.current?.end();
  }, [supported, start]);

  const turns = messages.slice(-LAST_TURNS);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={stick.scroller}
        onScroll={stick.onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-1 py-4"
      >
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl" aria-hidden>
              {persona.emoji}
            </span>
            <p className="font-bold tracking-tight text-2xl">Talk with {speakerName}</p>
            <p className="max-w-xs text-sm text-paper/70">
              A real conversation in English, Hindi or both. Plug in your headphones, ask what&apos;s on
              today, say &ldquo;stop&rdquo; or &ldquo;hold&rdquo; to pause the mic, and &ldquo;bye&rdquo; when you&apos;re done.
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
            <AnimatePresence>{working && <WorkingStatus key="working" label={job} />}</AnimatePresence>
            <li ref={stick.end} aria-hidden className="h-px list-none" />
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
            <TalkOrb
              phase={phase}
              working={working}
              label={label}
              onTap={() => (live ? session.current?.tap() : start())}
            />

            <p role="status" aria-live="polite" className="min-h-5 max-w-md text-center text-sm text-paper/70">
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
                <p className="max-w-xs text-center text-xs text-paper/55">
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

function talkLabel(phase: TalkPhase, speakerName: string, working: boolean, job: string) {
  if (phase === "idle") return `Tap to talk with ${speakerName}`;
  if (working) {
    if (phase === "paused") return `${job} Mic is paused. Tap to listen.`;
    if (phase === "listening") return `${job} You can still talk.`;
    return job;
  }
  if (phase === "starting") return "Getting ready…";
  if (phase === "paused") return "Stopped listening. Tap to start again.";
  if (phase === "listening") return "Listening… say “stop” or “hold” to pause";
  if (phase === "thinking") return "Thinking…";
  return "Speaking… talk or tap to interrupt";
}
