"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AssistantUIMessage } from "@/lib/ai/types";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { useAssistant } from "./chat-provider";
import ConversationList from "./conversation-list";
import { HistoryIcon, PlusIcon, SendIcon, StopIcon, TalkIcon } from "./icons";
import Markdown from "./markdown";
import MicButton from "./mic-button";
import ModeSwitch from "./mode-switch";
import PersonaPicker from "./persona-picker";
import SpeakButton from "./speak-button";
import TalkPanel from "./talk-panel";
import AttachFile, { uploadedStudyPrompt } from "./attach-file";
import { WorkingStatus } from "./working-mark";

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
    userId,
  } = useAssistant();
  const starters = persona.starters.length ? persona.starters : CUSTOM_STARTERS;
  const [historyOpen, setHistoryOpen] = useState(false);
  const stick = useStickToBottom(mode === "ask");

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const lastText = last ? textOf(last) : "";
  const waitingForText =
    busy && (!last || last.role === "user" || !lastText.trim());

  // Follow new tokens, a new prompt, and the thinking line.
  useEffect(() => {
    stick.pin();
  }, [stick.pin, messages.length, lastText, status, statusLabel, waitingForText]);

  return (
    <section className="relative flex min-h-[420px] flex-1 flex-col md:min-h-[520px]">
      <header className="flex items-center gap-1.5 border-b border-paper/10 pb-3">
        <PersonaPicker />
        <div className="flex min-w-0 flex-1 justify-center">
          <ModeSwitch mode={mode} onChange={setMode} className="w-full max-w-52" />
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          title="Past chats"
          aria-label="Past chats"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper/72 transition hover:bg-paper/5 hover:text-paper"
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper/72 transition hover:bg-paper/5 hover:text-paper"
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
            ref={stick.scroller}
            onScroll={stick.onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-1 py-5"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col justify-end gap-4">
                <p className="font-bold tracking-tight text-3xl">Hi {name}.</p>
                <div className="grid grid-cols-2 gap-2">
                  {starters.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      onClick={() => send(s)}
                      className="card min-h-11 rounded-2xl px-3 py-2 text-left text-[13px] leading-snug text-paper/80 transition hover:bg-paper/5 hover:text-paper"
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
                        className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ember px-4 py-2.5 text-[15px] text-on-ember shadow-[0_8px_20px_-12px_rgb(120_90_70/0.6)]"
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
                      className="card max-w-full rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed"
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
                  {busy && <WorkingStatus key="working" label={statusLabel ?? "Working on it…"} />}
                </AnimatePresence>
                {errorMessage &&
                  status === "error" &&
                  !(last?.role === "assistant" && textOf(last).trim()) && (
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
                <li ref={stick.end} aria-hidden className="h-px list-none" />
              </ul>
            )}
          </div>

          <Composer
            busy={busy}
            userId={userId}
            onTalk={() => setMode("talk")}
            onSend={(t) => {
              stick.follow();
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
  userId,
  onTalk,
  onSend,
  onStop,
}: {
  busy: boolean;
  userId: string;
  onTalk: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
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
      className="pt-2"
    >
      <div className="flex items-end gap-1.5 card p-1.5 shadow-sm transition focus-within:border-ember/60 focus-within:ring-4 focus-within:ring-ember/10">
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
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] text-paper outline-none placeholder:text-paper/50"
        />
        <AttachFile
          userId={userId}
          disabled={busy}
          onError={setMicError}
          onUploaded={(name) => {
            setMicError(null);
            const extra = value.trim();
            setValue("");
            onSend(uploadedStudyPrompt(name, extra));
          }}
        />
        <MicButton
          onText={(spoken) => {
            setMicError(null);
            const next =
              `${value}${value && !/\s$/.test(value) ? " " : ""}${spoken}`.trim();
            if (!next) return;
            if (busy) {
              setValue(next.slice(0, 2000));
              return;
            }
            setValue("");
            onSend(next);
          }}
          onError={setMicError}
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
        ) : !value.trim() ? (
          <button
            type="button"
            onClick={onTalk}
            aria-label="Talk out loud"
            title="Talk out loud"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember text-on-ember transition hover:bg-ember-light"
          >
            <TalkIcon />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember text-on-ember transition hover:bg-ember-light"
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
