"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { SparkleIcon } from "./icons";

// The card (and its markdown renderer) only loads once the switch is on.
const BriefingCard = dynamic(() => import("./briefing-card"), {
  loading: () => <div className="h-40 animate-pulse rounded-card bg-paper/5" />,
});

// Today's AI briefing on Overview: off until you switch it on.
export default function BriefingToggle() {
  const [on, setOn] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className="flex min-h-11 items-center gap-3 rounded-inset card px-3.5 py-2 text-left transition active:bg-ink"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-ember">
          <SparkleIcon />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-medium">Today&apos;s briefing</span>
        <span
          aria-hidden
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? "bg-ember" : "bg-paper/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>
      {on && <BriefingCard initial={null} />}
    </div>
  );
}
