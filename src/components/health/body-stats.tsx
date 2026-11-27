"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { deleteBodyLog } from "@/app/(dashboard)/health/actions";
import { formatShortDate } from "@/lib/finance";
import type { BodyLog } from "@/lib/fitness";

// Weight over time, newest on the right
export function WeightChart({ logs }: { logs: BodyLog[] }) {
  const points = [...logs].sort((a, b) =>
    a.logged_on.localeCompare(b.logged_on),
  );
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-paper/55">
        Log your weight on another day to see the trend.
      </p>
    );
  }

  const weights = points.map((p) => p.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const W = 320;
  const H = 120;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (w: number) => H - ((w - min) / span) * (H - 16) - 8;
  const line = points.map((p, i) => `${x(i)},${y(p.weight_kg)}`).join(" ");
  const change = weights[weights.length - 1] - weights[0];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-32 w-full"
        role="img"
        aria-label="Weight over time"
      >
        <motion.polyline
          points={line}
          fill="none"
          stroke="var(--ember)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8 }}
        />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.weight_kg)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill="var(--ember)"
          />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-paper/60">
        <span>{formatShortDate(points[0].logged_on)}</span>
        <span className={change <= 0 ? "text-moss" : "text-paper/72"}>
          {change > 0 ? "+" : ""}
          {change.toFixed(1)} kg over {points.length} entries
        </span>
        <span>{formatShortDate(points[points.length - 1].logged_on)}</span>
      </div>
    </div>
  );
}

export function LogList({ logs }: { logs: BodyLog[] }) {
  const [pending, startTransition] = useTransition();
  if (logs.length === 0) return null;
  return (
    <ul className={`mt-4 flex flex-col ${pending ? "opacity-60" : ""}`}>
      {logs.slice(0, 8).map((log) => (
        <li
          key={log.id}
          className="group flex items-center gap-3 border-b border-paper/5 py-2 text-sm last:border-0"
        >
          <span className="flex-1 text-paper/72">
            {formatShortDate(log.logged_on)}
          </span>
          <span className="font-medium tabular-nums">{log.weight_kg} kg</span>
          {log.waist_cm && (
            <span className="text-xs text-paper/60">waist {log.waist_cm}</span>
          )}
          <button
            type="button"
            aria-label="Delete entry"
            onClick={() => startTransition(() => deleteBodyLog(log.id))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-paper/45 transition hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
