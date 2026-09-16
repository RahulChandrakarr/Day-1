"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AssistantUIMessage } from "@/lib/ai/types";
import { useAssistant } from "./chat-provider";
import ConversationList from "./conversation-list";
import { HistoryIcon, PlusIcon, SendIcon, StopIcon } from "./icons";
import Markdown from "./markdown";
import MicButton from "./mic-button";
import ModeSwitch from "./mode-switch";
import PersonaPicker from "./persona-picker";
import SpeakButton from "./speak-button";
import type { SpeechLang } from "./speech";
import TalkPanel from "./talk-panel";

const CUSTOM_STARTERS = ["Hi! What can you help me with?", "Let's get started"];

function textOf(message: AssistantUIMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export default function ChatPanel() {
  const {
    messages,
    status,
    statusLabel,
    errorMessage,
    send,
    stop,
    regenerate,
    newChat,
    name,
    mode,
    setMode,
    persona,
  } = useAssistant();
  const starters = persona.starters.length ? persona.starters : CUSTOM_STARTERS;
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waitingForText =
    busy && (!last || last.role === "user" || !textOf(last).trim());

  // Follow new tokens unless the user scrolled up to read
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, statusLabel]);

  return (
    <section className="relative flex h-[calc(100dvh-14.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] min-h-[440px] flex-col overflow-hidden rounded-3xl border border-paper/10 bg-surface md:h-[min(80vh,760px)] md:min-h-[520px]">
      <header className="flex items-center gap-1.5 border-b border-paper/10 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <PersonaPicker />
        </div>
        <ModeSwitch mode={mode} onChange={setMode} />
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          title="Past chats"
          aria-label="Past chats"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-paper/60 transition hover:bg-paper/5 hover:text-paper"
        >
          <HistoryIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            newChat();
            setHistoryOpen(false);
          }}
          title="New chat"
          aria-label="New chat"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-paper/60 transition hover:bg-paper/5 hover:text-paper"
        >
          <PlusIcon />
        </button>
      </header>

      <AnimatePresence>
        {historyOpen && (
          <ConversationList onClose={() => setHistoryOpen(false)} />
        )}
      </AnimatePresence>

      {mode === "talk" ? (
        <TalkPanel key={persona.id} />
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end gap-4">
                <div>
                  <p className="text-3xl" aria-hidden>
                    {persona.emoji}
                  </p>
                  <p className="font-serif text-3xl">Hi {name}.</p>
                  <p className="mt-1 text-sm text-paper/55">
                    {persona.id === "assistant"
                      ? "Ask about your day, plans, health, money or documents, or tell me what to add or change."
                      : `${persona.name}: ${persona.tagline}.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {starters.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => send(s)}
                      className="rounded-full border border-paper/10 px-3 py-1.5 text-left text-sm text-paper/70 transition hover:border-paper/25 hover:bg-paper/5 hover:text-paper"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {messages.map((m, i) => {
                  const text = textOf(m);
                  const isLast = i === messages.length - 1;
                  if (m.role === "user") {
                    return (
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ember/15 px-4 py-2.5 text-[15px]"
                      >
                        {text}
                      </motion.li>
                    );
                  }
                  if (!text.trim()) return null;
                  return (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="max-w-full text-[15px] leading-relaxed"
                    >
                      <Markdown streaming={isLast && status === "streaming"}>
                        {text}
                      </Markdown>
                      {!(isLast && busy) && (
                        <SpeakButton
                          id={m.id}
                          text={text}
                          lang={persona.language}
                        />
                      )}
                    </motion.li>
                  );
                })}
                <AnimatePresence>
                  {waitingForText && (
                    <motion.li
                      key="status"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-sm text-paper/55"
                      role="status"
                    >
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember/60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
                      </span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={statusLabel ?? "Thinking…"}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                        >
                          {statusLabel ?? "Thinking…"}
                        </motion.span>
                      </AnimatePresence>
                    </motion.li>
                  )}
                </AnimatePresence>
                {errorMessage && status === "error" && (
                  <li
                    role="alert"
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                  >
                    <span className="flex-1">{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() => void regenerate()}
                      className="rounded-lg border border-current/30 px-3 py-1 font-medium"
                    >
                      Retry
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          <Composer
            busy={busy}
            lang={persona.language}
            onSend={(t) => {
              stickToBottom.current = true;
              send(t);
            }}
            onStop={() => void stop()}
          />
        </>
      )}
    </section>
  );
}

function Composer({
  busy,
  lang,
  onSend,
  onStop,
}: {
  busy: boolean;
  lang: SpeechLang;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  // Text typed before dictation started; spoken words are added after it
  const beforeDictation = useRef<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    if (busy || !value.trim()) return;
    onSend(value);
    setValue("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-paper/10 p-3"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-paper/10 bg-ink/60 p-1.5 transition focus-within:border-ember/60 focus-within:ring-4 focus-within:ring-ember/10">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={2000}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type a message…"
          aria-label="Message the assistant"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-paper outline-none placeholder:text-paper/35"
        />
        <MicButton
          lang={lang}
          onText={(spoken, done) => {
            if (beforeDictation.current === null)
              beforeDictation.current = value;
            const base = beforeDictation.current;
            setValue(
              `${base}${base && !/\s$/.test(base) ? " " : ""}${spoken}`.slice(
                0,
                2000,
              ),
            );
            setMicError(null);
            if (done) beforeDictation.current = null;
          }}
          onError={(message) => {
            beforeDictation.current = null;
            setMicError(message);
          }}
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper/10 text-paper transition hover:bg-paper/15"
          >
            <StopIcon />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember text-on-ember transition hover:bg-ember-light disabled:opacity-40"
          >
            <SendIcon />
          </button>
        )}
      </div>
      {micError && (
        <p
          role="alert"
          className="mt-1.5 px-1 text-xs text-red-700 dark:text-red-300"
        >
          {micError}
        </p>
      )}
    </form>
  );
}
