"use client";

import { useOptimistic, useTransition } from "react";
import { motion } from "framer-motion";
import { setExerciseDone } from "@/app/(dashboard)/health/actions";
import { CategoryIcon } from "@/components/health/exercise-icons";
import { categoryFromExercise } from "@/lib/exercise-library";
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
    <section className="overflow-hidden card">
      <div className="px-4 pb-2.5 pt-3.5">
        <div className="mb-2 flex justify-between text-xs text-paper/70">
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
          const phase = exercise.phase ?? "main";
          // Warm-up and cool-down stay the same every week of the block
          const target = exerciseTarget({
            ...weekTarget(exercise, phase === "main" ? week : null),
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
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    phase === "warmup"
                      ? "bg-ember/15 text-ember"
                      : phase === "cooldown"
                        ? "bg-moss/15 text-moss"
                        : "bg-paper/[0.06] text-paper/72"
                  }`}
                >
                  <CategoryIcon
                    category={categoryFromExercise(exercise.name, exercise.muscle, exercise.phase)}
                    size={16}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block break-words text-[15px] font-medium leading-snug ${
                      checked ? "text-paper/60 line-through" : ""
                    }`}
                  >
                    {exercise.name}
                  </span>
                  {(phase !== "main" || target) && (
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-paper/60 sm:hidden">
                      {phase !== "main" && (
                        <span>{phase === "warmup" ? "Warm-up" : "Cool-down"}</span>
                      )}
                      {target && <span className="font-semibold tabular-nums">{target}</span>}
                    </span>
                  )}
                </span>
                {phase !== "main" && (
                  <span className="hidden shrink-0 text-xs text-paper/60 sm:inline">
                    {phase === "warmup" ? "Warm-up" : "Cool-down"}
                  </span>
                )}
                {target && (
                  <span className="hidden shrink-0 rounded-full bg-paper/[0.06] px-2.5 py-1 text-xs font-semibold text-paper/70 sm:inline-block">
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
