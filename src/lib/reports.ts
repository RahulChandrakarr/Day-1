// Builds a month's training / habit / body summary so two months can be compared.

import { addDays, daysInMonth, monthRange } from "@/lib/finance";
import { bmi, weightChangeIsGood } from "@/lib/fitness";
import type { BodyLog, Goal } from "@/lib/fitness";
import { isoWeekday, type HabitCheckin, type PlanDay } from "@/lib/health";
import type { Habit } from "@/lib/journal";

export type BlockRange = {
  id: string;
  start_date: string;
  weeks: number;
};

export type HabitReport = {
  habit: Habit;
  done: number;
  missed: number;
  tracked: number; // days with any check-in
  rate: number; // done / days that have passed
  bestStreak: number;
  avgCount: number | null; // for habits that count something
  topReason: string | null;
};

export type MonthReport = {
  month: string;
  days: number; // days that have passed in the month
  gym: {
    plannedSessions: number;
    doneSessions: number;
    fullSessions: number;
    plannedExercises: number;
    doneExercises: number;
    adherence: number; // 0-1 of planned sessions started
    byMuscle: { muscle: string; count: number }[];
    restDays: number;
  };
  habits: HabitReport[];
  habitRate: number; // all habits together
  body: {
    start: number | null;
    end: number | null;
    change: number | null;
    waistChange: number | null;
    bmi: number | null;
    entries: number;
  };
  mood: { avg: number | null; energy: number | null; entries: number };
};

type Input = {
  month: string;
  today: string;
  planByBlock: Record<string, PlanDay[]>;
  blocks: BlockRange[];
  gymCheckins: Record<string, string[]>;
  habits: Habit[];
  habitCheckins: HabitCheckin[];
  bodyLogs: BodyLog[]; // this month, oldest first
  previousWeight: number | null; // last weight before the month
  heightCm: number | null;
  moods: { entry_date: string; mood: number | null; energy: number | null }[];
};

const blockEndDate = (b: BlockRange) => addDays(b.start_date, b.weeks * 7 - 1);

export function buildMonthReport(input: Input): MonthReport {
  const { month, today } = input;
  const { from, to } = monthRange(month);
  const last = to < today ? to : today;
  const days = last < from ? 0 : Number(last.slice(8)) - Number(from.slice(8)) + 1;

  // --- Gym ---------------------------------------------------------------
  let plannedSessions = 0;
  let doneSessions = 0;
  let fullSessions = 0;
  let plannedExercises = 0;
  let doneExercises = 0;
  let restDays = 0;
  const muscles = new Map<string, number>();

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const block = input.blocks.find(
      (b) => b.start_date <= date && blockEndDate(b) >= date,
    );
    const plan = input.planByBlock[block?.id ?? "manual"] ?? [];
    const day = plan.find((d) => d.weekday === isoWeekday(date));
    if (!day || day.rest || day.exercises.length === 0) {
      if (day?.rest) restDays++;
      continue;
    }
    plannedSessions++;
    plannedExercises += day.exercises.length;
    const done = input.gymCheckins[date] ?? [];
    const hits = day.exercises.filter((e) => done.includes(e.id));
    doneExercises += hits.length;
    if (hits.length > 0) doneSessions++;
    if (hits.length === day.exercises.length) fullSessions++;
    for (const e of hits) {
      const muscle = e.muscle?.trim() || "Other";
      muscles.set(muscle, (muscles.get(muscle) ?? 0) + 1);
    }
  }

  // --- Habits ------------------------------------------------------------
  const habits: HabitReport[] = input.habits.map((habit) => {
    const own = input.habitCheckins
      .filter((c) => c.habit_id === habit.id && c.check_date >= from && c.check_date <= last)
      .sort((a, b) => a.check_date.localeCompare(b.check_date));
    const done = own.filter((c) => c.done).length;
    const missed = own.filter((c) => !c.done).length;
    const counts = own.map((c) => c.count).filter((c): c is number => c !== null);
    const reasons = new Map<string, number>();
    for (const c of own) if (!c.done && c.reason) reasons.set(c.reason, (reasons.get(c.reason) ?? 0) + 1);
    const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    let best = 0;
    let run = 0;
    let previous: string | null = null;
    for (const c of own) {
      if (!c.done) {
        run = 0;
        previous = c.check_date;
        continue;
      }
      run = previous && addDays(previous, 1) === c.check_date ? run + 1 : 1;
      best = Math.max(best, run);
      previous = c.check_date;
    }

    return {
      habit,
      done,
      missed,
      tracked: own.length,
      rate: days > 0 ? done / days : 0,
      bestStreak: best,
      avgCount: counts.length
        ? counts.reduce((sum, c) => sum + c, 0) / counts.length
        : null,
      topReason,
    };
  });

  // --- Body and mood -----------------------------------------------------
  const logs = input.bodyLogs;
  const start = logs[0]?.weight_kg ?? input.previousWeight;
  const end = logs[logs.length - 1]?.weight_kg ?? null;
  const waistLogs = logs.filter((l) => l.waist_cm !== null);
  const moodValues = input.moods
    .filter((m) => m.entry_date >= from && m.entry_date <= last)
    .map((m) => m.mood)
    .filter((m): m is number => m !== null);
  const energyValues = input.moods
    .filter((m) => m.entry_date >= from && m.entry_date <= last)
    .map((m) => m.energy)
    .filter((m): m is number => m !== null);
  const avg = (list: number[]) =>
    list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;

  return {
    month,
    days: days || daysInMonth(month),
    gym: {
      plannedSessions,
      doneSessions,
      fullSessions,
      plannedExercises,
      doneExercises,
      adherence: plannedSessions ? doneSessions / plannedSessions : 0,
      byMuscle: [...muscles.entries()]
        .map(([muscle, count]) => ({ muscle, count }))
        .sort((a, b) => b.count - a.count),
      restDays,
    },
    habits,
    habitRate: habits.length
      ? habits.reduce((sum, h) => sum + h.rate, 0) / habits.length
      : 0,
    body: {
      start: start ?? null,
      end,
      change: start !== null && start !== undefined && end !== null ? end - start : null,
      waistChange:
        waistLogs.length > 1
          ? (waistLogs[waistLogs.length - 1].waist_cm ?? 0) - (waistLogs[0].waist_cm ?? 0)
          : null,
      bmi: end && input.heightCm ? bmi(end, input.heightCm) : null,
      entries: logs.length,
    },
    mood: {
      avg: avg(moodValues),
      energy: avg(energyValues),
      entries: moodValues.length,
    },
  };
}

export type Change = {
  label: string;
  detail: string;
  direction: "up" | "down" | "flat";
  good: boolean;
};

// What went up and what slipped, compared with last month. Weight only counts
// when the goal says which way it should go.
export function compareMonths(
  now: MonthReport,
  before: MonthReport,
  goal: Goal | null,
): Change[] {
  const changes: Change[] = [];
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  if (now.gym.plannedSessions || before.gym.plannedSessions) {
    const diff = now.gym.doneSessions - before.gym.doneSessions;
    changes.push({
      label: "Workouts done",
      detail:
        diff === 0
          ? `${now.gym.doneSessions} sessions, same as last month`
          : `${now.gym.doneSessions} sessions (${diff > 0 ? "+" : ""}${diff} vs last month)`,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      good: diff >= 0,
    });
    const adherenceDiff = now.gym.adherence - before.gym.adherence;
    if (Math.abs(adherenceDiff) >= 0.05)
      changes.push({
        label: "Sticking to the plan",
        detail: `${pct(now.gym.adherence)} of planned sessions, was ${pct(before.gym.adherence)}`,
        direction: adherenceDiff > 0 ? "up" : "down",
        good: adherenceDiff > 0,
      });
  }

  for (const habit of now.habits) {
    const previous = before.habits.find((h) => h.habit.id === habit.habit.id);
    if (!previous) continue;
    const diff = habit.rate - previous.rate;
    if (Math.abs(diff) >= 0.08)
      changes.push({
        label: habit.habit.name,
        detail: `${pct(habit.rate)} of days, was ${pct(previous.rate)}`,
        direction: diff > 0 ? "up" : "down",
        good: diff > 0,
      });
    if (habit.avgCount !== null && previous.avgCount !== null) {
      const countDiff = habit.avgCount - previous.avgCount;
      const better = habit.habit.kind === "quit" ? countDiff < 0 : countDiff > 0;
      if (Math.abs(countDiff) >= 0.3)
        changes.push({
          label: `${habit.habit.name} · ${habit.habit.count_label ?? "count"}`,
          detail: `${habit.avgCount.toFixed(1)} a day, was ${previous.avgCount.toFixed(1)}`,
          direction: countDiff > 0 ? "up" : "down",
          good: better,
        });
    }
  }

  const weightGood =
    now.body.change === null ? null : weightChangeIsGood(goal, now.body.change);
  if (now.body.change !== null && weightGood !== null && Math.abs(now.body.change) >= 0.3) {
    const losing = now.body.change < 0;
    changes.push({
      label: "Weight",
      detail: `${losing ? "" : "+"}${now.body.change.toFixed(1)} kg this month`,
      direction: losing ? "down" : "up",
      good: weightGood,
    });
  }

  if (now.mood.avg !== null && before.mood.avg !== null) {
    const diff = now.mood.avg - before.mood.avg;
    if (Math.abs(diff) >= 0.3)
      changes.push({
        label: "Mood",
        detail: `${now.mood.avg.toFixed(1)} of 5, was ${before.mood.avg.toFixed(1)}`,
        direction: diff > 0 ? "up" : "down",
        good: diff > 0,
      });
  }

  return changes;
}
