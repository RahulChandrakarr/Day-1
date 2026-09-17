"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { saveGymPlan } from "@/app/(dashboard)/health/actions";
import { WEEKDAYS, type Exercise, type Phase, type PlanDay } from "@/lib/health";

type DraftExercise = {
  key: string;
  id: string | null;
  name: string;
  sets: string;
  reps: string;
  weight_kg: string;
  minutes: string;
  note: string;
  phase: Phase;
};

type DraftDay = {
  weekday: number;
  title: string;
  rest: boolean;
  exercises: DraftExercise[];
};

const str = (n: number | null) => (n === null ? "" : String(n));

function toDraft(week: PlanDay[]): DraftDay[] {
  return week.map((d) => ({
    weekday: d.weekday,
    title: d.title,
    rest: d.rest,
    exercises: d.exercises.map((e: Exercise) => ({
      key: e.id,
      id: e.id,
      name: e.name,
      sets: str(e.sets),
      reps: str(e.reps),
      weight_kg: str(e.weight_kg),
      minutes: str(e.minutes),
      note: e.note ?? "",
      phase: e.phase ?? "main",
    })),
  }));
}

const blankExercise = (): DraftExercise => ({
  key: crypto.randomUUID(),
  id: null,
  name: "",
  sets: "",
  reps: "",
  weight_kg: "",
  minutes: "",
  note: "",
  phase: "main",
});

const inputClass =
  "h-10 w-full rounded-xl border border-paper/10 bg-ink px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const smallLabel = "text-[11px] uppercase tracking-wider text-paper/45";

const SUGGESTED_TITLES = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Cardio", "Full body"];

const PHASES: { value: Phase; label: string; active: string }[] = [
  { value: "warmup", label: "Warm-up", active: "border-ember/50 bg-ember/15 text-ember" },
  { value: "main", label: "Main", active: "border-paper/30 bg-paper/10 text-paper" },
  { value: "cooldown", label: "Cool-down", active: "border-moss/50 bg-moss/15 text-moss" },
];

export default function PlanDialog({
  week,
  startDay,
  label,
  blockId = null,
  variant = "secondary",
}: {
  week: PlanDay[];
  startDay: number;
  label: string;
  blockId?: string | null;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
        className={
          variant === "primary"
            ? "h-11 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light"
            : "h-10 rounded-xl border border-paper/15 px-4 text-sm font-medium transition hover:bg-paper/5"
        }
      >
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
              <motion.div
                key="dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Weekly gym plan"
                initial={{ y: "100%", opacity: 0.8 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="pointer-events-auto flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-paper/10 bg-surface shadow-2xl md:max-w-2xl md:rounded-3xl"
              >
                <PlanEditor
                  key={session}
                  week={week}
                  startDay={startDay}
                  blockId={blockId}
                  onClose={() => setOpen(false)}
                />
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PlanEditor({
  week,
  startDay,
  blockId,
  onClose,
}: {
  week: PlanDay[];
  startDay: number;
  blockId: string | null;
  onClose: () => void;
}) {
  const [days, setDays] = useState(() => toDraft(week));
  const [selected, setSelected] = useState(startDay);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const day = days.find((d) => d.weekday === selected)!;

  function updateDay(patch: Partial<DraftDay>) {
    setDays((all) =>
      all.map((d) => (d.weekday === selected ? { ...d, ...patch } : d)),
    );
  }

  function updateExercise(key: string, patch: Partial<DraftExercise>) {
    updateDay({
      exercises: day.exercises.map((e) =>
        e.key === key ? { ...e, ...patch } : e,
      ),
    });
  }

  function copyTo(target: number) {
    setDays((all) =>
      all.map((d) =>
        d.weekday === target
          ? {
              ...d,
              title: day.title,
              rest: day.rest,
              // Copies are new exercises on the other day
              exercises: day.exercises.map((e) => ({
                ...e,
                key: crypto.randomUUID(),
                id: null,
              })),
            }
          : d,
      ),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveGymPlan(
        days.map((d) => ({
          weekday: d.weekday,
          title: d.title,
          rest: d.rest,
          exercises: d.rest
            ? []
            : d.exercises.map((e) => ({
                id: e.id ?? "",
                name: e.name,
                sets: e.sets === "" ? null : Number(e.sets),
                reps: e.reps === "" ? null : Number(e.reps),
                weight_kg: e.weight_kg === "" ? null : Number(e.weight_kg),
                minutes: e.minutes === "" ? null : Number(e.minutes),
                note: e.note,
                phase: e.phase,
              })),
        })),
        blockId,
      );
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-paper/10 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl sm:text-2xl">Weekly gym plan</h2>
          <p className="text-xs text-paper/50">
            Set it once; the tracker shows each day&apos;s exercises.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-paper/50 transition hover:bg-paper/10 hover:text-paper"
        >
          ×
        </button>
      </header>

      <div className="border-b border-paper/10 px-4 py-3 sm:px-5">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => {
            const d = days.find((x) => x.weekday === w.value)!;
            const active = w.value === selected;
            const count = d.rest ? 0 : d.exercises.filter((e) => e.name).length;
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => setSelected(w.value)}
                aria-pressed={active}
                className={`flex flex-col items-center rounded-xl py-1.5 text-xs transition ${
                  active
                    ? "bg-ember text-on-ember"
                    : "text-paper/60 hover:bg-paper/5"
                }`}
              >
                <span className="font-medium">{w.short}</span>
                <span
                  className={`text-[10px] ${active ? "text-on-ember/70" : "text-paper/40"}`}
                >
                  {d.rest ? "Rest" : count ? `${count} ex` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={smallLabel}>
              {WEEKDAYS[selected - 1].label} workout
            </span>
            <input
              value={day.title}
              maxLength={40}
              onChange={(e) => updateDay({ title: e.target.value })}
              placeholder="e.g. Chest & triceps"
              disabled={day.rest}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={() => updateDay({ rest: !day.rest })}
            aria-pressed={day.rest}
            className={`h-10 rounded-xl border px-3 text-sm transition ${
              day.rest
                ? "border-moss/50 bg-moss/15 text-paper"
                : "border-paper/15 text-paper/70 hover:bg-paper/5"
            }`}
          >
            😴 Rest day
          </button>
        </div>

        {!day.rest && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateDay({ title: t })}
                  className="rounded-full border border-paper/10 px-2.5 py-0.5 text-xs text-paper/55 transition hover:bg-paper/5 hover:text-paper"
                >
                  {t}
                </button>
              ))}
            </div>

            <ul className="mt-4 flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {day.exercises.map((e, i) => (
                  <motion.li
                    key={e.key}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-paper/10 bg-ink p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs text-paper/40">
                        {i + 1}
                      </span>
                      <input
                        value={e.name}
                        maxLength={60}
                        onChange={(ev) =>
                          updateExercise(e.key, { name: ev.target.value })
                        }
                        placeholder="Exercise, e.g. Bench press"
                        className={`${inputClass} font-medium`}
                      />
                      <button
                        type="button"
                        aria-label="Remove exercise"
                        onClick={() =>
                          updateDay({
                            exercises: day.exercises.filter(
                              (x) => x.key !== e.key,
                            ),
                          })
                        }
                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-xl text-lg text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 pl-7">
                      {(
                        [
                          ["sets", "Sets", "3"],
                          ["reps", "Reps", "12"],
                          ["weight_kg", "Kg", "40"],
                          ["minutes", "Min", "—"],
                        ] as const
                      ).map(([field, fieldLabel, placeholder]) => (
                        <label key={field} className="flex min-w-0 flex-col gap-1">
                          <span className={smallLabel}>{fieldLabel}</span>
                          <input
                            inputMode="decimal"
                            value={e[field]}
                            onChange={(ev) =>
                              updateExercise(e.key, {
                                [field]: ev.target.value.replace(/[^\d.]/g, ""),
                              })
                            }
                            placeholder={placeholder}
                            className={`${inputClass} text-center tabular-nums`}
                          />
                        </label>
                      ))}
                    </div>
                    <div
                      role="radiogroup"
                      aria-label="Part of the workout"
                      className="mt-2 flex flex-wrap gap-1.5 pl-7"
                    >
                      {PHASES.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          role="radio"
                          aria-checked={e.phase === p.value}
                          onClick={() => updateExercise(e.key, { phase: p.value })}
                          className={`rounded-full border px-2.5 py-1 text-xs transition ${
                            e.phase === p.value
                              ? p.active
                              : "border-paper/10 text-paper/55 hover:bg-paper/5 hover:text-paper"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 pl-7">
                      <input
                        value={e.note}
                        maxLength={120}
                        onChange={(ev) =>
                          updateExercise(e.key, { note: ev.target.value })
                        }
                        placeholder="Note (optional), e.g. slow negatives"
                        className={inputClass}
                      />
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <button
              type="button"
              onClick={() =>
                updateDay({ exercises: [...day.exercises, blankExercise()] })
              }
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-dashed border-paper/20 text-sm text-paper/60 transition hover:border-paper/40 hover:text-paper"
            >
              + Add exercise
            </button>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper/10 pt-4">
          <span className="text-xs text-paper/45">
            Copy {WEEKDAYS[selected - 1].short} to
          </span>
          {WEEKDAYS.filter((w) => w.value !== selected).map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => copyTo(w.value)}
              className="rounded-full border border-paper/10 px-2.5 py-1 text-xs text-paper/60 transition hover:bg-paper/5 hover:text-paper"
            >
              {w.short}
            </button>
          ))}
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-paper/10 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 sm:px-5">
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-paper/15 px-5 text-sm font-medium transition hover:bg-paper/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-11 flex-1 rounded-xl bg-ember text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save plan"}
          </button>
        </div>
      </footer>
    </>
  );
}
