"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { saveBodyProfile, startNextBlock } from "@/app/(dashboard)/health/actions";
import {
  ACTIVITIES,
  EQUIPMENTS,
  EXPERIENCES,
  GOALS,
  type Activity,
  type BodyLog,
  type BodyProfile,
  type Equipment,
  type Experience,
  type Goal,
  type Sex,
} from "@/lib/fitness";
import { primaryButtonClass, quietButtonClass } from "@/components/ui/kit";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-inset px-3 text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/65";

type Draft = {
  sex: Sex;
  age: string;
  height_cm: string;
  activity: Activity;
  goal: Goal;
  experience: Experience;
  days_per_week: string;
  equipment: Equipment;
  session_minutes: string;
  weight_kg: string;
  waist_cm: string;
  neck_cm: string;
  hip_cm: string;
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export default function BodyForm({
  profile,
  latest,
  date,
  hasBlock,
}: {
  profile: BodyProfile | null;
  latest: BodyLog | null;
  date: string;
  hasBlock: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    sex: profile?.sex ?? "male",
    age: text(profile?.age),
    height_cm: text(profile?.height_cm),
    activity: profile?.activity ?? "moderate",
    goal: profile?.goal ?? "build",
    experience: profile?.experience ?? "beginner",
    days_per_week: String(profile?.days_per_week ?? 4),
    equipment: profile?.equipment ?? "full_gym",
    session_minutes: String(profile?.session_minutes ?? 60),
    weight_kg: text(latest?.weight_kg),
    waist_cm: text(latest?.waist_cm),
    neck_cm: text(latest?.neck_cm),
    hip_cm: text(latest?.hip_cm),
  });
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();
  const [building, startBuilding] = useTransition();

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus("idle");
  };

  const num = (value: string) => (value.trim() === "" ? null : Number(value));

  function payload() {
    return {
      profile: {
        sex: draft.sex,
        age: num(draft.age),
        height_cm: num(draft.height_cm),
        activity: draft.activity,
        goal: draft.goal,
        experience: draft.experience,
        days_per_week: Number(draft.days_per_week),
        equipment: draft.equipment,
        session_minutes: Number(draft.session_minutes),
      },
      measurement: draft.weight_kg.trim()
        ? {
            date,
            weight_kg: Number(draft.weight_kg),
            waist_cm: num(draft.waist_cm),
            neck_cm: num(draft.neck_cm),
            hip_cm: num(draft.hip_cm),
          }
        : undefined,
    };
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveBodyProfile(payload());
      if (result.ok) {
        setStatus("saved");
        router.refresh();
      } else setError(result.error);
    });
  }

  function build() {
    if (
      hasBlock &&
      !confirm("Replace the plan you're on with a new 4-week plan?")
    )
      return;
    setError(null);
    startBuilding(async () => {
      const saved = await saveBodyProfile(payload());
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const result = await startNextBlock();
      if (result.ok) router.push("/health/gym");
      else setError(result.error);
    });
  }

  // Set once and rarely changed, so it stays folded until there's nothing yet
  return (
    <details open={!profile} className="card group p-5">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h3 className="font-bold tracking-tight text-[19px]">Edit your details</h3>
        <AnimatePresence>
          {status === "saved" && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs font-medium text-moss"
              role="status"
            >
              Saved ✓
            </motion.span>
          )}
        </AnimatePresence>
        <span aria-hidden className="ml-auto text-paper/50 transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Sex</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-paper/10 bg-inset p-1">
            {(["male", "female"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={draft.sex === s}
                onClick={() => set({ sex: s })}
                className={`h-10 rounded-lg text-sm font-medium capitalize transition ${
                  draft.sex === s
                    ? "bg-surface text-paper shadow-sm"
                    : "text-paper/65 hover:text-paper"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <Field label="Age" suffix="years">
          <input
            inputMode="numeric"
            value={draft.age}
            onChange={(e) => set({ age: e.target.value.replace(/\D/g, "") })}
            placeholder="25"
            className={inputClass}
          />
        </Field>
        <Field label="Height" suffix="cm">
          <input
            inputMode="decimal"
            value={draft.height_cm}
            onChange={(e) =>
              set({ height_cm: e.target.value.replace(/[^\d.]/g, "") })
            }
            placeholder="175"
            className={inputClass}
          />
        </Field>
        <Field label="Weight" suffix="kg">
          <input
            inputMode="decimal"
            value={draft.weight_kg}
            onChange={(e) =>
              set({ weight_kg: e.target.value.replace(/[^\d.]/g, "") })
            }
            placeholder="70"
            className={inputClass}
          />
        </Field>
      </div>

      <details className="mt-4">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm text-paper/70 transition hover:text-paper">
          Tape measurements (for the body fat estimate)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Waist" suffix="cm">
            <input
              inputMode="decimal"
              value={draft.waist_cm}
              onChange={(e) =>
                set({ waist_cm: e.target.value.replace(/[^\d.]/g, "") })
              }
              placeholder="84"
              className={inputClass}
            />
          </Field>
          <Field label="Neck" suffix="cm">
            <input
              inputMode="decimal"
              value={draft.neck_cm}
              onChange={(e) =>
                set({ neck_cm: e.target.value.replace(/[^\d.]/g, "") })
              }
              placeholder="38"
              className={inputClass}
            />
          </Field>
          {draft.sex === "female" && (
            <Field label="Hip" suffix="cm">
              <input
                inputMode="decimal"
                value={draft.hip_cm}
                onChange={(e) =>
                  set({ hip_cm: e.target.value.replace(/[^\d.]/g, "") })
                }
                placeholder="95"
                className={inputClass}
              />
            </Field>
          )}
        </div>
      </details>

      <div className="mt-6 flex flex-col gap-4">
        <Choice
          label="Goal"
          value={draft.goal}
          options={GOALS}
          onChange={(goal) => set({ goal })}
        />
        <Choice
          label="Experience"
          value={draft.experience}
          options={EXPERIENCES}
          onChange={(experience) => set({ experience })}
        />
        <Choice
          label="Daily activity"
          value={draft.activity}
          options={ACTIVITIES}
          onChange={(activity) => set({ activity })}
        />
        <Choice
          label="Where you train"
          value={draft.equipment}
          options={EQUIPMENTS}
          onChange={(equipment) => set({ equipment })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Days a week" suffix="days">
            <select
              value={draft.days_per_week}
              onChange={(e) => set({ days_per_week: e.target.value })}
              className={inputClass}
            >
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </Field>
          <Field label="Session length" suffix="min">
            <select
              value={draft.session_minutes}
              onChange={(e) => set({ session_minutes: e.target.value })}
              className={inputClass}
            >
              {[30, 45, 60, 75, 90].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={save}
          disabled={pending || building}
          className={`${primaryButtonClass} sm:flex-1`}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={build}
          disabled={pending || building}
          className={`${quietButtonClass} min-h-12 sm:flex-1`}
        >
          {building
            ? "Building…"
            : hasBlock
              ? "Build a new 4-week plan"
              : "Build my 4-week plan"}
        </button>
      </div>
    </details>
  );
}

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={labelClass}>
        {label}
        {suffix && <span className="ml-1 normal-case text-paper/50">({suffix})</span>}
      </span>
      {children}
    </label>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint: string }[]; // hint shows on hover
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`flex h-10 items-center rounded-full border px-3.5 text-sm transition ${
              value === o.value
                ? "border-paper/40 bg-paper/10 text-paper"
                : "border-paper/10 text-paper/75 hover:bg-paper/5"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
