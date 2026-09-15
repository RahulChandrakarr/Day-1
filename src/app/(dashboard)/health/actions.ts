"use server";

import { revalidatePath } from "next/cache";
import { isValidDate } from "@/lib/finance";
import { FEELINGS, REASONS, type PlanDay } from "@/lib/health";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;

type Result = { ok: true } | { ok: false; error: string };

async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new Error("Not signed in.");
  return supabase;
}

function refresh() {
  revalidatePath("/", "layout");
}

const whole = (value: unknown, min: number, max: number) => {
  const n = Number(value);
  return value === null || value === "" || !Number.isFinite(n)
    ? null
    : Math.min(Math.max(Math.round(n), min), max);
};

// Replaces the whole weekly plan. Exercises keep their id (and their check-offs) when edited.
export async function saveGymPlan(week: PlanDay[]): Promise<Result> {
  if (!Array.isArray(week) || week.length > 7)
    return { ok: false, error: "Invalid plan." };

  const supabase = await authedClient();
  const { data: existing, error: loadError } = await supabase
    .from("gym_plan_days")
    .select("id, weekday, exercises:gym_plan_exercises(id)");
  if (loadError) return { ok: false, error: loadError.message };

  for (const day of week) {
    const weekday = Number(day?.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)
      return { ok: false, error: "Invalid day." };

    const exercises = (Array.isArray(day.exercises) ? day.exercises : [])
      .map((e) => ({
        id: typeof e?.id === "string" && uuid.test(e.id) ? e.id : null,
        name: String(e?.name ?? "").trim().slice(0, 60),
        sets: whole(e?.sets, 1, 50),
        reps: whole(e?.reps, 1, 500),
        weight_kg:
          e?.weight_kg === null || String(e?.weight_kg ?? "") === ""
            ? null
            : Math.min(Math.max(Number(e.weight_kg) || 0, 0), 9999),
        minutes: whole(e?.minutes, 1, 600),
        note: String(e?.note ?? "").trim().slice(0, 120) || null,
      }))
      .filter((e) => e.name)
      .slice(0, 40);

    const current = existing?.find((d) => d.weekday === weekday);
    const { data: saved, error } = await supabase
      .from("gym_plan_days")
      .upsert(
        {
          weekday,
          title: String(day.title ?? "").trim().slice(0, 40),
          rest: Boolean(day.rest),
        },
        { onConflict: "user_id,weekday" },
      )
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    const keepIds = new Set(exercises.map((e) => e.id).filter(Boolean));
    const removed = (current?.exercises ?? [])
      .map((e) => e.id as string)
      .filter((id) => !keepIds.has(id));
    if (removed.length) {
      const { error: delError } = await supabase
        .from("gym_plan_exercises")
        .delete()
        .in("id", removed);
      if (delError) return { ok: false, error: delError.message };
    }

    for (const [position, e] of exercises.entries()) {
      const fields = {
        day_id: saved.id,
        position,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight_kg: e.weight_kg,
        minutes: e.minutes,
        note: e.note,
      };
      const { error: exError } = e.id
        ? await supabase.from("gym_plan_exercises").update(fields).eq("id", e.id)
        : await supabase.from("gym_plan_exercises").insert(fields);
      if (exError) return { ok: false, error: exError.message };
    }
  }

  refresh();
  return { ok: true };
}

export async function setExerciseDone(
  exerciseId: string,
  date: string,
  done: boolean,
): Promise<Result> {
  if (!uuid.test(exerciseId) || !isValidDate(date))
    return { ok: false, error: "Invalid exercise." };
  const supabase = await authedClient();
  const { error } = done
    ? await supabase
        .from("gym_checkins")
        .upsert(
          { exercise_id: exerciseId, check_date: date },
          { onConflict: "user_id,exercise_id,check_date", ignoreDuplicates: true },
        )
    : await supabase
        .from("gym_checkins")
        .delete()
        .eq("exercise_id", exerciseId)
        .eq("check_date", date);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function saveHabitCheckin(input: {
  habitId: string;
  date: string;
  done: boolean | null; // null clears the day's check-in
  feeling?: string | null;
  reason?: string | null;
  note?: string;
}): Promise<Result> {
  if (!uuid.test(input?.habitId) || !isValidDate(input?.date))
    return { ok: false, error: "Invalid habit." };
  const supabase = await authedClient();

  if (input.done === null) {
    const { error } = await supabase
      .from("habit_checkins")
      .delete()
      .eq("habit_id", input.habitId)
      .eq("check_date", input.date);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true };
  }

  const done = Boolean(input.done);
  const feeling = FEELINGS.some((f) => f.value === input.feeling)
    ? input.feeling
    : null;
  const reason = REASONS.some((r) => r.value === input.reason)
    ? input.reason
    : null;
  const { error } = await supabase.from("habit_checkins").upsert(
    {
      habit_id: input.habitId,
      check_date: input.date,
      done,
      feeling: done ? feeling : null,
      reason: done ? null : reason,
      note: String(input.note ?? "").slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,habit_id,check_date" },
  );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
