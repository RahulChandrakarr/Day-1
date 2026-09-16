"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshIcon, SparkleIcon } from "./icons";
import Markdown from "./markdown";

type Briefing = { content: string; updatedAt: string } | null;

const time = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default function BriefingCard({ initial }: { initial: Briefing }) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [updatedAt, setUpdatedAt] = useState(initial?.updatedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const generate = useCallback(async (refresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Couldn't write your briefing.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      setStreaming(true);
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += value;
        setContent(text);
        setLoading(false);
      }
      if (!text.trim())
        throw new Error(
          "The AI service didn't respond. It may be out of credits — try again later.",
        );
      setUpdatedAt(new Date().toISOString());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't write your briefing.",
      );
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, []);

  useEffect(() => {
    if (initial || started.current) return;
    started.current = true;
    void generate(false);
  }, [initial, generate]);

  const busy = loading || streaming;

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-ember/15 blur-3xl"
      />
      <header className="relative flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ember/15 text-ember">
          <SparkleIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl leading-tight">
            Today&apos;s briefing
          </h2>
          <p className="text-xs text-paper/45">
            {busy
              ? "Writing…"
              : updatedAt
                ? `Updated ${time.format(new Date(updatedAt))}`
                : "Written by your assistant"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate(true)}
          disabled={busy}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-paper/10 px-3 text-sm text-paper/65 transition hover:bg-paper/5 hover:text-paper disabled:opacity-50"
        >
          <motion.span
            animate={busy ? { rotate: 360 } : { rotate: 0 }}
            transition={
              busy ? { duration: 1, repeat: Infinity, ease: "linear" } : {}
            }
            className="flex"
          >
            <RefreshIcon />
          </motion.span>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </header>

      <div className="relative mt-4 min-h-24 text-[15px] leading-relaxed">
        <AnimatePresence mode="wait">
          {loading && !content ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2.5"
              role="status"
            >
              <p className="text-sm text-paper/50">Reading your week…</p>
              {[92, 78, 85, 60].map((w, i) => (
                <motion.span
                  key={i}
                  className="block h-3 rounded-full bg-paper/10"
                  style={{ width: `${w}%` }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </motion.div>
          ) : content ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: loading ? 0.5 : 1 }}
            >
              <Markdown streaming={streaming}>{content}</Markdown>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
