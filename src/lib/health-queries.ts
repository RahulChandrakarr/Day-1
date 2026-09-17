import "server-only";
import type { BodyLog, BodyProfile } from "@/lib/fitness";
import { phaseRank, type Exercise, type HabitCheckin, type PlanDay } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";

type DayRow = Omit<PlanDay, "exercises"> & {
  exercises: (Exercise & { position: number; weight_kg: number | string | null })[];
};

export async function getGymPlan(blockId: string | null): Promise<PlanDay[]> {
  const supabase = await createClient();
  let query = supabase
    .from("gym_plan_days")
    .select(
      "weekday, title, rest, exercises:gym_plan_exercises(id, name, sets, reps, weight_kg, minutes, note, position, muscle, rest_seconds, rir, phase)",
    )
    .order("weekday");
  query = blockId ? query.eq("block_id", blockId) : query.is("block_id", null);
  const { data, error } = await query.returns<DayRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    weekday: d.weekday,
    title: d.title,
    rest: d.rest,
    exercises: [...d.exercises]
      .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.position - b.position)
      .map((e) => ({
        id: e.id,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight_kg: e.weight_kg === null ? null : Number(e.weight_kg),
        minutes: e.minutes,
        note: e.note,
        muscle: e.muscle ?? null,
        rest_seconds: e.rest_seconds ?? null,
        rir: e.rir ?? null,
        phase: e.phase ?? "main",
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
    .select("habit_id, check_date, done, count, feeling, reason, note")
    .gte("check_date", from)
    .lte("check_date", to)
    .returns<HabitCheckin[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Body profile, measurements and training blocks
// ---------------------------------------------------------------------------
export async function getBodyProfile(): Promise<BodyProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_profile")
    .select(
      "sex, age, height_cm, activity, goal, experience, days_per_week, equipment, session_minutes",
    )
    .maybeSingle<BodyProfile>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    height_cm: data.height_cm === null ? null : Number(data.height_cm),
  };
}

export async function getBodyLogs(limit = 60): Promise<BodyLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_logs")
    .select("id, logged_on, weight_kg, waist_cm, neck_cm, hip_cm")
    .order("logged_on", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    logged_on: row.logged_on as string,
    weight_kg: Number(row.weight_kg),
    waist_cm: num(row.waist_cm),
    neck_cm: num(row.neck_cm),
    hip_cm: num(row.hip_cm),
  }));
}

export type GymBlock = {
  id: string;
  name: string;
  start_date: string;
  weeks: number;
  split: string;
  goal: string;
  level: string;
  days_per_week: number;
  number: number;
};

// The block running now, or the most recent one
export async function getCurrentBlock(): Promise<GymBlock | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_blocks")
    .select(
      "id, name, start_date, weeks, split, goal, level, days_per_week, number",
    )
    .order("start_date", { ascending: false })
    .limit(1)
    .returns<GymBlock[]>();
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

// Every block, newest first (for reports that span months)
export async function getBlocks(): Promise<GymBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_blocks")
    .select(
      "id, name, start_date, weeks, split, goal, level, days_per_week, number",
    )
    .order("start_date", { ascending: false })
    .returns<GymBlock[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Plan days for every block plus the hand-made plan, keyed by block id ("manual" when none)
export async function getAllPlanDays(): Promise<Record<string, PlanDay[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gym_plan_days")
    .select(
      "block_id, weekday, title, rest, exercises:gym_plan_exercises(id, name, sets, reps, weight_kg, minutes, note, position, muscle, rest_seconds, rir, phase)",
    )
    .order("weekday")
    .returns<(DayRow & { block_id: string | null })[]>();
  if (error) throw new Error(error.message);
  const byBlock: Record<string, PlanDay[]> = {};
  for (const d of data ?? []) {
    const key = d.block_id ?? "manual";
    (byBlock[key] ??= []).push({
      weekday: d.weekday,
      title: d.title,
      rest: d.rest,
      exercises: [...d.exercises]
        .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.position - b.position)
        .map((e) => ({
          id: e.id,
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          weight_kg: e.weight_kg === null ? null : Number(e.weight_kg),
          minutes: e.minutes,
          note: e.note,
          muscle: e.muscle ?? null,
          rest_seconds: e.rest_seconds ?? null,
          rir: e.rir ?? null,
          phase: e.phase ?? "main",
        })),
    });
  }
  return byBlock;
}

export async function getBodyLogsBetween(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_logs")
    .select("id, logged_on, weight_kg, waist_cm, neck_cm, hip_cm")
    .gte("logged_on", from)
    .lte("logged_on", to)
    .order("logged_on", { ascending: true });
  if (error) throw new Error(error.message);
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    logged_on: row.logged_on as string,
    weight_kg: Number(row.weight_kg),
    waist_cm: num(row.waist_cm),
    neck_cm: num(row.neck_cm),
    hip_cm: num(row.hip_cm),
  }));
}

// Mood and energy per day, for the report
export async function getMoodLogs(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date, mood, energy")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .returns<{ entry_date: string; mood: number | null; energy: number | null }[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}
