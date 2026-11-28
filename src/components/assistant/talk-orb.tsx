"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TalkPhase } from "./talk-session";
import { WorkingHalo } from "./working-mark";

export default function TalkOrb({
  phase,
  working,
  label,
  onTap,
}: {
  phase: TalkPhase;
  working: boolean;
  label: string;
  onTap: () => void;
}) {
  const pulse = !working && (phase === "listening" || phase === "speaking");
  const spinning = !working && (phase === "thinking" || phase === "starting");

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={label}
      className="relative flex h-24 w-24 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-ember/30"
    >
      <AnimatePresence>{working && <WorkingHalo key="loom" />}</AnimatePresence>
      <AnimatePresence>
        {pulse && (
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
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 1.6, repeat: Infinity, ease: "linear" } : {}}
        className={`relative z-[1] flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-colors ${orbTone(phase, working)}`}
      >
        {working && (phase === "thinking" || phase === "starting") ? (
          <span className="working-core working-core-lg" />
        ) : spinning ? (
          <span className="h-16 w-16 rounded-full bg-surface" />
        ) : phase === "paused" ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
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
      {working && phase === "listening" && (
        <span className="absolute right-2 top-2 z-[2] h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_3px_color-mix(in_oklab,var(--surface)_80%,transparent)]" />
      )}
    </button>
  );
}

function orbTone(phase: TalkPhase, working: boolean) {
  if (working) return "bg-ember text-on-ember";
  if (phase === "paused") return "bg-paper/15 text-paper";
  if (phase === "listening") return "bg-red-500 text-white";
  if (phase === "thinking" || phase === "starting") {
    return "bg-[conic-gradient(var(--ember),transparent_70%)] text-ember";
  }
  return "bg-ember text-on-ember";
}
