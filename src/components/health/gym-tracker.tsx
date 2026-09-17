"use client";

import { useOptimistic, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { setExerciseDone } from "@/app/(dashboard)/health/actions";
import { CategoryIcon } from "@/components/health/exercise-icons";
import MotionIllustration from "@/components/health/exercise-motion";
import { getExerciseInfo, type ExerciseInfo } from "@/lib/exercise-library";
import { type BlockWeek, weekTarget } from "@/lib/fitness";
import {
  exerciseTarget,
  type Exercise,
  type Phase,
  type PlanDay,
} from "@/lib/health";

const SECTIONS: { phase: Phase; label: string; hint: string }[] = [
  { phase: "warmup", label: "Warm-up", hint: "Loosen up and raise your heart rate" },
  { phase: "main", label: "Training", hint: "The main work" },
  { phase: "cooldown", label: "Cool-down", hint: "Stretch so your muscles can relax" },
];

const ACCENT: Record<Phase, { heading: string; icon: string; art: string }> = {
  warmup: { heading: "text-ember", icon: "bg-ember/15 text-ember", art: "text-ember" },
  main: { heading: "text-paper/60", icon: "bg-paper/10 text-paper/80", art: "text-paper/80" },
  cooldown: { heading: "text-moss", icon: "bg-moss/15 text-moss", art: "text-moss" },
};

const label = "text-[11px] font-semibold uppercase tracking-wider text-paper/45";

// Today's exercises from the plan, ticked off one by one. Tap an exercise to
// see what it works and how to do it.
export default function GymTracker({
  day,
  date,
  doneIds,
  week = null,
}: {
  day: PlanDay;
  date: string;
  doneIds: string[];
  week?: BlockWeek | null;
}) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(
    doneIds,
    (current: string[], change: { id: string; done: boolean }) =>
      change.done
        ? [...current.filter((id) => id !== change.id), change.id]
        : current.filter((id) => id !== change.id),
  );
  const [openId, setOpenId] = useState<string | null>(null);

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
      <p className="rounded-[14px] border border-dashed border-paper/10 py-8 text-center text-sm text-paper/50">
        😴 Rest day. Recover well.
      </p>
    );
  }

  if (total === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-paper/10 py-8 text-center text-sm text-paper/50">
        Nothing planned for this day.
      </p>
    );
  }

  const groups = SECTIONS.map((s) => ({
    ...s,
    exercises: day.exercises.filter((e) => (e.phase ?? "main") === s.phase),
  })).filter((g) => g.exercises.length > 0);
  // A plan with only main work doesn't need section headings
  const headed = groups.length > 1 || groups[0].phase !== "main";

  return (
    <div className="flex flex-col gap-4">
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

      {groups.map((g) => (
        <section key={g.phase} className="flex flex-col gap-2">
          {headed && (
            <header className="flex items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <h3 className={`text-xs font-semibold uppercase tracking-wider ${ACCENT[g.phase].heading}`}>
                  {g.label}
                </h3>
                <p className="text-xs text-paper/40">{g.hint}</p>
              </div>
              <span className="shrink-0 text-xs text-paper/40 tabular-nums">
                {g.exercises.filter((e) => done.includes(e.id)).length}/{g.exercises.length}
              </span>
            </header>
          )}
          <ul className="flex flex-col gap-2">
            {g.exercises.map((e, i) => (
              <ExerciseRow
                key={e.id}
                exercise={e}
                phase={g.phase}
                index={i}
                week={week}
                checked={done.includes(e.id)}
                open={openId === e.id}
                onToggle={() => toggle(e.id)}
                onOpen={() => setOpenId((id) => (id === e.id ? null : e.id))}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ExerciseRow({
  exercise: e,
  phase,
  index,
  week,
  checked,
  open,
  onToggle,
  onOpen,
}: {
  exercise: Exercise;
  phase: Phase;
  index: number;
  week: BlockWeek | null;
  checked: boolean;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const main = phase === "main";
  // Warm-up and cool-down stay the same every week of the block
  const target = exerciseTarget({
    ...weekTarget(e, main ? week : null),
    weight_kg: e.weight_kg,
  });
  const info = getExerciseInfo(e.name, e.muscle, e.phase);
  const reserve = main && e.rir !== null && e.rir !== undefined && !week?.deload;
  const summary = [
    e.muscle,
    e.rest_seconds ? `${e.rest_seconds}s rest` : null,
    reserve ? `leave ${e.rir} in reserve` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pill = checked ? "bg-moss/15 text-moss" : "bg-paper/10 text-paper/75";
  const panelId = `exercise-${e.id}`;

  return (
    <li
      className={`overflow-hidden rounded-2xl border transition ${
        checked ? "border-moss/40 bg-moss/10" : "border-paper/10 bg-ink"
      }`}
    >
      <div className="flex items-stretch pr-2 sm:pr-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={e.name}
          onClick={onToggle}
          className="flex w-12 shrink-0 items-center justify-center sm:w-14"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
              checked ? "border-moss bg-moss text-ink" : "border-paper/25"
            }`}
          >
            <AnimatePresence>
              {checked && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  width={16}
                  height={16}
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
        </button>

        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left sm:gap-3 sm:py-3.5"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${ACCENT[phase].icon}`}
          >
            <CategoryIcon category={info.category} size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block break-words font-medium leading-snug ${
                checked ? "text-paper/55 line-through" : ""
              }`}
            >
              {main && <span className="mr-1.5 text-xs text-paper/35">{index + 1}.</span>}
              {e.name}
            </span>
            {(target || summary) && (
              <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-paper/45">
                {target && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium tabular-nums sm:hidden ${pill}`}
                  >
                    {target}
                  </span>
                )}
                {summary && <span className="truncate">{summary}</span>}
              </span>
            )}
          </span>
          {target && (
            <span
              className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums sm:inline-block ${pill}`}
            >
              {target}
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`shrink-0 text-paper/35 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <ExerciseDetail
              exercise={e}
              info={info}
              art={ACCENT[phase].art}
              tips={[
                e.note,
                e.rest_seconds ? `Rest ${e.rest_seconds}s between sets` : null,
                reserve ? `Stop each set about ${e.rir} reps before you'd fail` : null,
              ].filter((tip): tip is string => Boolean(tip))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function ExerciseDetail({
  exercise,
  info,
  art,
  tips,
}: {
  exercise: Exercise;
  info: ExerciseInfo;
  art: string;
  tips: string[];
}) {
  return (
    <div className="grid gap-4 border-t border-paper/10 px-3 pb-4 pt-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:px-4">
      <div className={`flex items-center justify-center rounded-xl bg-paper/5 p-2 ${art}`}>
        <MotionIllustration category={info.category} className="h-32 w-full max-w-[240px] sm:h-auto" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 text-sm">
        <div>
          <p className={label}>Works</p>
          <p className="mt-0.5 text-paper/85">{info.target}</p>
        </div>
        {info.instructions.length > 0 ? (
          <div>
            <p className={label}>How to do it</p>
            <ol className="mt-1 flex list-decimal flex-col gap-1 pl-4 text-paper/75 marker:text-paper/35">
              {info.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : (
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              `${exercise.name} exercise proper form`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="self-start text-sm font-medium text-ember hover:underline"
          >
            Watch how to do it ↗
          </a>
        )}
        {tips.length > 0 && (
          <div>
            <p className={label}>Tips</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-paper/75 marker:text-paper/35">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
