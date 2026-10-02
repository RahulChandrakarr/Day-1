"use client";

import type { ChatMode } from "./chat-provider";

const MODES: { value: ChatMode; label: string }[] = [
  { value: "ask", label: "Ask" },
  { value: "talk", label: "Talk" },
];

// Ask (type) or Talk (hands-free voice).
export default function ModeSwitch({
  mode,
  onChange,
  className = "",
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Assistant mode"
      className={`relative grid shrink-0 grid-cols-2 rounded-xl card p-0.5 text-sm font-semibold ${className}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[10px] bg-ember shadow-sm transition-transform duration-200 ${
          mode === "talk" ? "translate-x-full" : ""
        }`}
      />
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={mode === m.value}
          onClick={() => onChange(m.value)}
          className={`relative h-9 px-4 transition-colors ${
            mode === m.value ? "text-on-ember" : "text-paper/55 hover:text-paper"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
