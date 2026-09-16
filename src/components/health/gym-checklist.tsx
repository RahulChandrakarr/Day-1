"use client";

import { useOptimistic, useTransition } from "react";
import { motion } from "framer-motion";
import { setExerciseDone } from "@/app/(dashboard)/health/actions";
import { type BlockWeek, weekTarget } from "@/lib/fitness";
import { exerciseTarget, type Exercise } from "@/lib/health";

// Compact checklist used on Overview: the exercises still to do, with the
// day's progress across the top.
export default function GymChecklist({
  exercises,
  date,
  doneBefore,
  week = null,
}: {
  exercises: Exercise[]; // the ones still pending
  date: string;
  doneBefore: number; // already ticked off today
  week?: BlockWeek | null;
}) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(
    [] as string[],
    (current: string[], id: string) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
  );

  const total = doneBefore + exercises.length;
  const finished = doneBefore + done.length;
  const percent = total ? Math.round((finished / total) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-[18px] border border-paper/10 bg-surface">
      <div className="px-4 pb-2.5 pt-3.5">
        <div className="mb-2 flex justify-between text-xs text-paper/55">
          <span className="font-semibold text-moss">
            {finished} done · {total - finished} to go
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-[5px] rounded-[3px] bg-paper/10">
          <motion.div
            className="h-[5px] rounded-[3px] bg-moss"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <ul>
        {exercises.map((exercise) => {
          const checked = done.includes(exercise.id);
          const target = exerciseTarget({
            ...weekTarget(exercise, week),
            weight_kg: exercise.weight_kg,
          });
          return (
            <li key={exercise.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() =>
                  startTransition(async () => {
                    setDone(exercise.id);
                    await setExerciseDone(exercise.id, date, !checked);
                  })
                }
                className="flex min-h-11 w-full items-center gap-3 border-t border-paper/[0.06] px-4 py-3 text-left transition active:bg-paper/[0.03]"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[13px] text-on-ember transition ${
                    checked
                      ? "border-moss bg-moss text-white"
                      : "border-paper/20 bg-transparent"
                  }`}
                >
                  {checked && "✓"}
                </span>
                <span
                  className={`flex-1 text-[15px] font-medium ${
                    checked ? "text-paper/45 line-through" : ""
                  }`}
                >
                  {exercise.name}
                </span>
                {target && (
                  <span className="shrink-0 rounded-full bg-paper/[0.06] px-2.5 py-1 text-xs font-semibold text-paper/55">
                    {target}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
