import "server-only";
import type { Exercise, HabitCheckin, PlanDay } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";

type DayRow = Omit<PlanDay, "exercises"> & {
  exercises: (Exercise & { position: number; weight_kg: number | string | null })[];
};

export async function getGymPlan(): Promise<PlanDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_plan_days")
    .select(
      "weekday, title, rest, exercises:gym_plan_exercises(id, name, sets, reps, weight_kg, minutes, note, position)",
    )
    .order("weekday")
    .returns<DayRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    weekday: d.weekday,
    title: d.title,
    rest: d.rest,
    exercises: [...d.exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight_kg: e.weight_kg === null ? null : Number(e.weight_kg),
        minutes: e.minutes,
        note: e.note,
      })),
  }));
}

// { "YYYY-MM-DD": [exerciseId, ...] }
export async function getGymCheckins(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_checkins")
    .select("exercise_id, check_date")
    .gte("check_date", from)
    .lte("check_date", to);
  if (error) throw new Error(error.message);
  const byDate: Record<string, string[]> = {};
  for (const row of data ?? [])
    (byDate[row.check_date] ??= []).push(row.exercise_id);
  return byDate;
}

export async function getHabitCheckins(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habit_checkins")
    .select("habit_id, check_date, done, feeling, reason, note")
    .gte("check_date", from)
    .lte("check_date", to)
    .returns<HabitCheckin[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
