"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { assistantTransport, readError, textOf } from "@/components/assistant/chat-provider";
import { SendIcon, SparkleIcon } from "@/components/assistant/icons";
import {
  canListen,
  createListener,
  speak,
  stopSpeaking,
  type Listener,
  type SpeechLang,
} from "@/components/assistant/speech";
import { setTheme } from "@/components/theme";
import type { AssistantUIMessage } from "@/lib/ai/types";

const POS_KEY = "day-one:quick-assistant-pos";
const CHAT_KEY = "day-one:quick-conversation";
const LANG_KEY = "day-one:quick-assistant-lang";
const SIZE = 56;
const EDGE = 8;
const DRAG_PX = 6;

type Phase = "idle" | "listening" | "thinking" | "answer" | "typing";
type Pos = { x: number; y: number };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const clamp = ({ x, y }: Pos): Pos => ({
  x: Math.min(Math.max(x, EDGE), window.innerWidth - SIZE - EDGE),
  y: Math.min(Math.max(y, EDGE), window.innerHeight - SIZE - EDGE),
});

function savedPos(): Pos | null {
  const raw = typeof window === "undefined" ? null : read(POS_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Pos;
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? clamp(p) : null;
  } catch {
    return null;
  }
}

// One ongoing "Quick assistant" chat, so follow-ups like "make that 150" work
function quickChatId() {
  if (typeof window === "undefined") return "quick";
  const saved = read(CHAT_KEY);
  if (saved) return saved;
  const id = crypto.randomUUID();
  write(CHAT_KEY, id);
  return id;
}

const noop = () => () => {};

// A small round button on every page: tap, speak, and it does it or answers
// in a line or two, out loud. Drag it anywhere; it remembers the spot.
export default function QuickAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  const [pos, setPos] = useState<Pos | null>(savedPos);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState<{ text: string; isError: boolean } | null>(null);
  const [typed, setTyped] = useState("");
  const [lang, setLang] = useState<SpeechLang>(() =>
    typeof window !== "undefined" && read(LANG_KEY) === "hi-IN" ? "hi-IN" : "en-IN",
  );
  const [chatId] = useState(quickChatId);
  const [transport] = useState(assistantTransport);
  const listener = useRef<Listener | null>(null);
  const hideTimer = useRef<number | null>(null);
  const dataChanged = useRef(false);
  const drag = useRef<{ x: number; y: number; from: Pos; moved: boolean } | null>(null);
  // Bumped on resize so the bubble is re-placed even at the default spot
  const [, setViewport] = useState(0);
  const suppressClick = useRef(false);

  const clearHide = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const hideSoon = () => {
    clearHide();
    hideTimer.current = window.setTimeout(() => {
      setPhase("idle");
      setReply(null);
    }, 8000);
  };

  function answer(text: string, isError: boolean) {
    setReply({ text: text || "Done.", isError });
    setPhase("answer");
    if (isError || !text) return hideSoon();
    void speak(text, lang).then(hideSoon);
  }

  const chat = useChat<AssistantUIMessage>({
    id: chatId,
    transport,
    onData: (part) => {
      if (part.type !== "data-action") return;
      if (part.data.kind === "theme") setTheme(part.data.value);
      else dataChanged.current = true;
    },
    onFinish: ({ message, isError }) => {
      if (!isError) answer(textOf(message), false);
      if (dataChanged.current) {
        dataChanged.current = false;
        router.refresh();
      }
    },
    onError: (error) => answer(readError(error) ?? "Something went wrong.", true),
  });

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return setPhase("idle");
    setHeard(trimmed);
    setPhase("thinking");
    void chat.sendMessage({ text: trimmed }, { body: { mode: "talk", source: "quick" } });
  }

  function listen() {
    stopSpeaking();
    clearHide();
    setReply(null);
    setHeard("");
    if (!canListen()) return setPhase("typing");
    setPhase("listening");
    listener.current = createListener(
      lang,
      {
        onText: setHeard,
        onPause: (text) => {
          listener.current = null;
          send(text);
        },
        onError: (message) => {
          listener.current = null;
          answer(message, true);
        },
        onIdle: () => {
          listener.current?.abort();
          listener.current = null;
          setPhase("idle");
        },
      },
      { pauseMs: 1500, idleMs: 10_000 },
    );
  }

  function close() {
    listener.current?.abort();
    listener.current = null;
    stopSpeaking();
    clearHide();
    setReply(null);
    setPhase("idle");
  }

  function tap() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (phase === "listening") return listener.current?.finish();
    if (phase === "thinking") return;
    listen();
  }

  // Keep it on screen when the window changes size
  useEffect(() => {
    const onResize = () => {
      setPos((p) => (p ? clamp(p) : p));
      setViewport((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      listener.current?.abort();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, from: { x: rect.left, y: rect.top }, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    d.moved = true;
    setPos(clamp({ x: d.from.x + dx, y: d.from.y + dy }));
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    setPos((p) => {
      if (p) write(POS_KEY, JSON.stringify(p));
      return p;
    });
  }

  if (!onClient || pathname.startsWith("/assistant")) return null;

  // The bubble opens toward the middle of the screen and never leaves it
  const vw = window.innerWidth;
  const buttonX = pos ? pos.x : vw - SIZE - (vw >= 768 ? 24 : 16);
  const onRight = buttonX + SIZE / 2 > vw / 2;
  const bubbleWidth = Math.min(304, vw - 32);
  const bubbleLeft =
    Math.min(Math.max(onRight ? buttonX + SIZE - bubbleWidth : buttonX, 16), vw - 16 - bubbleWidth) -
    buttonX;
  const below = !!pos && pos.y < 220;
  const open = phase !== "idle";
  const label =
    phase === "listening"
      ? "Listening. Tap to send now"
      : phase === "thinking"
        ? "Working on it"
        : phase === "answer"
          ? "Tap to speak again"
          : "Quick assistant: tap and speak";

  return (
    <div
      className={`fixed z-40 ${
        pos ? "" : "bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] right-4 md:bottom-6 md:right-6"
      }`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: below ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ width: bubbleWidth, left: bubbleLeft }}
            className={`absolute rounded-2xl border border-paper/10 bg-surface p-3 text-sm shadow-xl ${
              below ? "top-[4.25rem]" : "bottom-[4.25rem]"
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ember">
                {phase === "listening"
                  ? "Listening…"
                  : phase === "thinking"
                    ? "Working on it…"
                    : phase === "typing"
                      ? "Type a request"
                      : "Assistant"}
              </span>
              <div className="flex items-center gap-1">
                {(phase === "listening" || phase === "typing") && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = lang === "en-IN" ? "hi-IN" : "en-IN";
                      setLang(next);
                      write(LANG_KEY, next);
                      if (phase === "listening") {
                        listener.current?.abort();
                        listener.current = null;
                        setPhase("idle");
                      }
                    }}
                    className="rounded-full border border-paper/15 px-2 py-0.5 text-[11px] text-paper/60"
                    aria-label="Switch language"
                  >
                    {lang === "en-IN" ? "EN" : "हिं"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-base text-paper/50 hover:bg-paper/10"
                >
                  ×
                </button>
              </div>
            </div>

            {phase === "typing" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(typed);
                  setTyped("");
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  maxLength={2000}
                  placeholder="Add ₹120 for groceries…"
                  aria-label="Your request"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-paper/10 bg-ink px-3 text-sm outline-none focus:border-ember/70"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember text-on-ember"
                >
                  <SendIcon />
                </button>
              </form>
            ) : (
              <>
                {heard && phase !== "answer" && (
                  <p className="break-words text-paper/70">&ldquo;{heard}&rdquo;</p>
                )}
                {phase === "listening" && !heard && (
                  <p className="text-paper/50">Say something like &ldquo;add ₹120 for groceries&rdquo;.</p>
                )}
                {phase === "answer" && reply && (
                  <p
                    className={`break-words leading-snug ${
                      reply.isError ? "text-red-700 dark:text-red-300" : "text-paper"
                    }`}
                  >
                    {reply.text}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  {phase === "listening" ? (
                    <button
                      type="button"
                      onClick={() => {
                        listener.current?.abort();
                        listener.current = null;
                        setPhase("typing");
                      }}
                      className="text-paper/55 underline-offset-2 hover:underline"
                    >
                      Type instead
                    </button>
                  ) : (
                    <span />
                  )}
                  {phase === "answer" && (
                    <Link href="/assistant" className="font-medium text-ember" onClick={close}>
                      Open in Assistant →
                    </Link>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={tap}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        style={{ touchAction: "none" }}
        className="relative flex h-14 w-14 cursor-grab select-none items-center justify-center rounded-full bg-ember text-on-ember shadow-lg shadow-black/25 transition-transform active:scale-95 active:cursor-grabbing"
      >
        {phase === "listening" && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-ember"
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {phase === "thinking" ? (
          <span
            aria-hidden
            className="h-6 w-6 animate-spin rounded-full border-[3px] border-current border-t-transparent"
          />
        ) : phase === "listening" ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="relative">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        ) : (
          <SparkleIcon size={24} />
        )}
      </button>
    </div>
  );
}
