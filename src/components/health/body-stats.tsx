"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { deleteBodyLog, saveBodyProfile } from "@/app/(dashboard)/health/actions";
import { inputClass } from "@/components/ui/kit";
import { formatShortDate } from "@/lib/finance";
import { weightChangeIsGood, type BodyLog, type BodyProfile, type Goal } from "@/lib/fitness";

// The frequent action on Body: today's weight in one row. It saves through
// the same action as the full form, carrying the profile and the latest tape
// measurements forward so the body fat estimate keeps working.
export function LogWeight({
  profile,
  latest,
  date,
}: {
  profile: BodyProfile;
  latest: BodyLog | null;
  date: string;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();

  function log() {
    setError(null);
    startSaving(async () => {
      const result = await saveBodyProfile({
        profile,
        measurement: {
          date,
          weight_kg: Number(weight),
          waist_cm: latest?.waist_cm,
          neck_cm: latest?.neck_cm,
          hip_cm: latest?.hip_cm,
        },
      });
      if (result.ok) {
        setWeight("");
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        log();
      }}
      className="mb-4"
    >
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder={latest ? `${latest.weight_kg} kg` : "Today's weight, kg"}
          aria-label="Today's weight in kg"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={pending || !weight.trim()}
          className="h-12 shrink-0 rounded-full bg-ember px-6 text-[15px] font-semibold text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}

// Weight over time, newest on the right
export function WeightChart({ logs, goal }: { logs: BodyLog[]; goal: Goal | null }) {
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
        <span
          className={
            weightChangeIsGood(goal, change) ? "text-moss" : "text-paper/72"
          }
        >
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
  const [all, setAll] = useState(false);
  if (logs.length === 0) return null;
  // getBodyLogs brings the latest 60
  const shown = all ? logs : logs.slice(0, 3);
  return (
    <>
      <ul className={`mt-4 flex flex-col ${pending ? "opacity-60" : ""}`}>
        {shown.map((log) => (
          <li
            key={log.id}
            className="flex items-center gap-3 border-b border-paper/5 py-0.5 text-sm last:border-0"
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
              aria-label={`Delete ${formatShortDate(log.logged_on)} entry`}
              onClick={() => {
                if (confirm(`Delete the ${formatShortDate(log.logged_on)} weigh-in?`))
                  startTransition(() => deleteBodyLog(log.id));
              }}
              className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-lg text-paper/45 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {logs.length > 3 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 min-h-10 text-sm font-medium text-paper/65 transition hover:text-paper"
        >
          {all ? "Show fewer" : `Show all (${logs.length})`}
        </button>
      )}
    </>
  );
}
