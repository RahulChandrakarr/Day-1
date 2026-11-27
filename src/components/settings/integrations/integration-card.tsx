"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type IntegrationStatus = { label: string; tone: "on" | "off" | "warn" };

const tones = {
  on: "bg-moss/15 text-moss",
  off: "bg-paper/[0.06] text-paper/70",
  warn: "bg-[#b3372e]/10 text-[#b3372e] dark:text-red-300",
};

// One service on Settings -> Integrations, as a row that opens: its mark, name,
// whether it's linked and what it brings into Day One; tap to see its
// controls. Rows start closed, except one with a problem, so it gets seen.
// Every new integration gets one of these, so the list reads the same as it
// grows.
export default function IntegrationCard({
  letter,
  markClassName,
  name,
  description,
  status,
  children,
}: {
  letter: string;
  markClassName: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(status.tone === "warn");
  const panelId = useId();

  return (
    <section className="card min-w-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-paper/[0.03] sm:px-5"
      >
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${markClassName}`}
        >
          {letter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-bold tracking-[-0.01em]">{name}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[status.tone]}`}
            >
              {status.label}
            </span>
          </span>
          <span
            className={`mt-0.5 block text-sm text-paper/70 ${open ? "" : "line-clamp-1"}`}
          >
            {description}
          </span>
        </span>
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-paper/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          // Height only: fading the panel would switch the card's glass blur off
          <motion.div
            id={panelId}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-paper/10 px-4 pb-5 pt-4 sm:px-5">
              <div className="max-w-2xl">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
