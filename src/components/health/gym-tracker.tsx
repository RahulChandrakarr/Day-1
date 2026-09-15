"use client";

import { useOptimistic, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { setExerciseDone } from "@/app/(dashboard)/health/actions";
import { exerciseTarget, type PlanDay } from "@/lib/health";

// Today's exercises from the plan, ticked off one by one.
export default function GymTracker({
  day,
  date,
  doneIds,
  compact = false,
}: {
  day: PlanDay;
  date: string;
  doneIds: string[];
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(
    doneIds,
    (current: string[], change: { id: string; done: boolean }) =>
      change.done
        ? [...current.filter((id) => id !== change.id), change.id]
        : current.filter((id) => id !== change.id),
  );

  const total = day.exercises.length;
  const finished = day.exercises.filter((e) => done.includes(e.id)).length;
  const complete = total > 0 && finished === total;

  function toggle(id: string) {
    const next = !done.includes(id);
    startTransition(async () => {
      setDone({ id, done: next });
      await setExerciseDone(id, date, next);
    });
  }

  if (day.rest) {
    return (
      <p className="rounded-2xl border border-dashed border-paper/10 py-8 text-center text-sm text-paper/50">
        😴 Rest day. Recover well.
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-paper/10 py-8 text-center text-sm text-paper/50">
        Nothing planned for this day.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className={complete ? "font-medium text-moss" : "text-paper/60"}>
            {complete ? "Workout complete 💪" : `${finished} of ${total} done`}
          </span>
          <span className="text-xs text-paper/45 tabular-nums">
            {Math.round((finished / total) * 100)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper/10">
          <motion.div
            className={`h-full rounded-full ${complete ? "bg-moss" : "bg-ember"}`}
            initial={false}
            animate={{ width: `${(finished / total) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {day.exercises.map((e, i) => {
          const checked = done.includes(e.id);
          const target = exerciseTarget(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(e.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border text-left transition ${
                  compact ? "p-2.5" : "p-3 sm:p-4"
                } ${
                  checked
                    ? "border-moss/40 bg-moss/10"
                    : "border-paper/10 bg-ink/30 hover:border-paper/25"
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full border-2 transition ${
                    compact ? "h-6 w-6" : "h-8 w-8"
                  } ${checked ? "border-moss bg-moss text-ink" : "border-paper/25"}`}
                >
                  <AnimatePresence>
                    {checked && (
                      <motion.svg
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        width={compact ? 12 : 16}
                        height={compact ? 12 : 16}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12l5 5L20 7" />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-medium ${
                      checked ? "text-paper/55 line-through" : ""
                    }`}
                  >
                    {!compact && (
                      <span className="mr-1.5 text-xs text-paper/35">{i + 1}.</span>
                    )}
                    {e.name}
                  </span>
                  {!compact && e.note && (
                    <span className="block truncate text-xs text-paper/45">
                      {e.note}
                    </span>
                  )}
                </span>
                {target && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
                      checked ? "bg-moss/15 text-moss" : "bg-paper/10 text-paper/75"
                    }`}
                  >
                    {target}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
