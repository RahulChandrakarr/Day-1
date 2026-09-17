// Gym plan and habit types and helpers (safe for server and client).

import { addDays } from "./finance";

export const WEEKDAYS = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
  { value: 7, short: "Sun", label: "Sunday" },
];

// 1 = Monday ... 7 = Sunday for a YYYY-MM-DD date
export function isoWeekday(date: string) {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

export type Phase = "warmup" | "main" | "cooldown";

export type Exercise = {
  id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  minutes: number | null;
  note: string | null;
  muscle?: string | null;
  rest_seconds?: number | null;
  rir?: number | null;
  phase?: Phase | null;
};

const PHASE_ORDER: Record<Phase, number> = { warmup: 0, main: 1, cooldown: 2 };

// Warm-up first, cool-down last; untagged exercises count as main work
export const phaseRank = (phase?: Phase | null) => PHASE_ORDER[phase ?? "main"];

export type PlanDay = {
  weekday: number;
  title: string;
  rest: boolean;
  exercises: Exercise[];
};

// Full week, with empty days filled in
export function fullWeek(days: PlanDay[]): PlanDay[] {
  return WEEKDAYS.map(
    (w) =>
      days.find((d) => d.weekday === w.value) ?? {
        weekday: w.value,
        title: "",
        rest: false,
        exercises: [],
      },
  );
}

// "3 × 12 · 40 kg · 10 min"
export function exerciseTarget(e: {
  sets: number | null;
  reps: number | null;
  minutes: number | null;
  weight_kg?: number | null;
}) {
  const parts: string[] = [];
  if (e.sets && e.reps) parts.push(`${e.sets} × ${e.reps}`);
  else if (e.sets) parts.push(`${e.sets} sets`);
  else if (e.reps) parts.push(`${e.reps} reps`);
  if (e.weight_kg) parts.push(`${Number(e.weight_kg)} kg`);
  if (e.minutes) parts.push(`${e.minutes} min`);
  return parts.join(" · ");
}

export const FEELINGS = [
  { value: "easy", emoji: "😌", label: "Easy" },
  { value: "okay", emoji: "🙂", label: "Okay" },
  { value: "hard", emoji: "😬", label: "Hard" },
  { value: "proud", emoji: "💪", label: "Proud" },
] as const;

// What to ask after a check-in depends on the habit: quitting something
// fails for different reasons than not getting around to something.
export const REASONS = [
  { value: "stress", label: "Stress", kinds: ["quit", "build"] },
  { value: "craving", label: "Craving", kinds: ["quit"] },
  { value: "social", label: "With friends", kinds: ["quit"] },
  { value: "boredom", label: "Boredom", kinds: ["quit"] },
  { value: "autopilot", label: "Out of habit", kinds: ["quit"] },
  { value: "busy", label: "No time", kinds: ["build"] },
  { value: "tired", label: "Too tired", kinds: ["build"] },
  { value: "no_energy", label: "Couldn't be bothered", kinds: ["build"] },
  { value: "forgot", label: "Forgot", kinds: ["build"] },
  { value: "unwell", label: "Unwell", kinds: ["quit", "build"] },
  { value: "travel", label: "Travelling", kinds: ["quit", "build"] },
  { value: "other", label: "Other", kinds: ["quit", "build"] },
] as const;

export const reasonsFor = (kind: "quit" | "build") =>
  REASONS.filter((r) => (r.kinds as readonly string[]).includes(kind));

export const feelingsFor = (kind: "quit" | "build") =>
  kind === "quit"
    ? FEELINGS.map((f) =>
        f.value === "easy"
          ? { ...f, label: "No urge" }
          : f.value === "hard"
            ? { ...f, label: "Tough" }
            : f,
      )
    : FEELINGS;

export const reasonLabel = (value: string) =>
  REASONS.find((r) => r.value === value)?.label ?? value;

export type Feeling = (typeof FEELINGS)[number]["value"];
export type Reason = (typeof REASONS)[number]["value"];

export type HabitCheckin = {
  habit_id: string;
  check_date: string;
  done: boolean;
  count: number | null;
  feeling: Feeling | null;
  reason: Reason | null;
  note: string;
};

// Days in a row marked done, counting back from today (or yesterday if today isn't checked yet)
export function streak(checkins: HabitCheckin[], today: string) {
  const done = new Set(
    checkins.filter((c) => c.done).map((c) => c.check_date),
  );
  let day = done.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (done.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
