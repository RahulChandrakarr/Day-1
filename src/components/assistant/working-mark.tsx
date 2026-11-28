"use client";

import { AnimatePresence, motion } from "framer-motion";

const RINGS = [
  { rotate: 8, delay: "0s", duration: "2.35s" },
  { rotate: 68, delay: "-0.9s", duration: "2.9s" },
  { rotate: 128, delay: "-1.6s", duration: "2.15s" },
] as const;

const FLECKS = [
  { left: "38%", delay: "0s" },
  { left: "52%", delay: "0.7s" },
  { left: "44%", delay: "1.4s" },
  { left: "60%", delay: "2s" },
] as const;

function Loom({ comet }: { comet: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      {RINGS.map((ring) => (
        <ellipse
          key={ring.rotate}
          className={comet ? "working-loom-comet" : "working-loom-ring"}
          cx="50"
          cy="50"
          rx="42"
          ry="15.5"
          transform={`rotate(${ring.rotate} 50 50)`}
          style={{ animationDelay: ring.delay, animationDuration: ring.duration }}
        />
      ))}
    </svg>
  );
}

// Threads weaving around the mic: work is happening, not just a spinner.
export function WorkingHalo() {
  return (
    <motion.span
      key="loom"
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35 }}
      className="working-halo pointer-events-none absolute left-1/2 top-1/2 h-[9.75rem] w-[9.75rem] -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    >
      <Loom comet />
      {FLECKS.map((fleck) => (
        <span
          key={fleck.delay}
          className="working-fleck"
          style={{ left: fleck.left, animationDelay: fleck.delay }}
        />
      ))}
    </motion.span>
  );
}

export function WorkingMark({ className = "" }: { className?: string }) {
  return (
    <span className={`working-mark relative inline-flex h-8 w-8 shrink-0 items-center justify-center ${className}`} aria-hidden>
      <span className="absolute inset-0">
        <Loom comet />
      </span>
      <span className="working-core" />
    </span>
  );
}

export function WorkingStatus({ label }: { label: string }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex list-none items-center gap-2.5 text-sm text-paper/75"
      role="status"
      aria-live="polite"
    >
      <WorkingMark />
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.li>
  );
}
