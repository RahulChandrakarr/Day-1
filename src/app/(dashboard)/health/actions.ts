"use server";

import { revalidatePath } from "next/cache";
import { isValidDate, todayISO } from "@/lib/finance";
import type { BodyProfile } from "@/lib/fitness";
import { generateBlock } from "@/lib/workout-generator";
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

// Replaces the weekly plan, inside a block when one is given.
// Exercises keep their id (and their check-offs) when edited.
export async function saveGymPlan(
  week: PlanDay[],
  blockId: string | null = null,
): Promise<Result> {
  if (!Array.isArray(week) || week.length > 7)
    return { ok: false, error: "Invalid plan." };
  if (blockId !== null && !uuid.test(blockId))
    return { ok: false, error: "Invalid plan." };

  const supabase = await authedClient();
  const existingQuery = supabase
    .from("gym_plan_days")
    .select("id, weekday, exercises:gym_plan_exercises(id)");
  const { data: existing, error: loadError } = await (blockId
    ? existingQuery.eq("block_id", blockId)
    : existingQuery.is("block_id", null));
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
    const fields = {
      title: String(day.title ?? "").trim().slice(0, 40),
      rest: Boolean(day.rest),
    };

    let dayId = current?.id as string | undefined;
    if (dayId) {
      const { error } = await supabase
        .from("gym_plan_days")
        .update(fields)
        .eq("id", dayId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { data: saved, error } = await supabase
        .from("gym_plan_days")
        .insert({ ...fields, weekday, block_id: blockId })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      dayId = saved.id;
    }

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
      const row = {
        day_id: dayId,
        position,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        weight_kg: e.weight_kg,
        minutes: e.minutes,
        note: e.note,
      };
      const { error: exError } = e.id
        ? await supabase.from("gym_plan_exercises").update(row).eq("id", e.id)
        : await supabase.from("gym_plan_exercises").insert(row);
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
  count?: number | null;
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
  const rawCount = Number(input.count);
  const count =
    input.count === null || input.count === undefined || !Number.isFinite(rawCount)
      ? null
      : Math.min(Math.max(Math.round(rawCount), 0), 1000);
  const { error } = await supabase.from("habit_checkins").upsert(
    {
      habit_id: input.habitId,
      check_date: input.date,
      done,
      count,
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

// ---------------------------------------------------------------------------
// Body profile, measurements and generated training blocks
// ---------------------------------------------------------------------------
export async function saveBodyProfile(input: {
  profile: BodyProfile;
  measurement?: {
    date: string;
    weight_kg: number;
    waist_cm?: number | null;
    neck_cm?: number | null;
    hip_cm?: number | null;
  };
}): Promise<Result> {
  const p = input?.profile;
  if (!p) return { ok: false, error: "Nothing to save." };
  const number = (value: unknown, min: number, max: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };

  const supabase = await authedClient();
  const { error } = await supabase.from("body_profile").upsert(
    {
      user_id: (await supabase.auth.getClaims()).data!.claims.sub,
      sex: p.sex === "female" ? "female" : "male",
      age: number(p.age, 12, 100),
      height_cm: number(p.height_cm, 100, 250),
      activity: p.activity,
      goal: p.goal,
      experience: p.experience,
      days_per_week: number(p.days_per_week, 2, 6) ?? 4,
      equipment: p.equipment,
      session_minutes: number(p.session_minutes, 20, 150) ?? 60,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };

  const m = input.measurement;
  if (m && isValidDate(m.date)) {
    const weight = number(m.weight_kg, 25, 400);
    if (weight === null) return { ok: false, error: "Enter a valid weight." };
    const { error: logError } = await supabase.from("body_logs").upsert(
      {
        logged_on: m.date,
        weight_kg: weight,
        waist_cm: number(m.waist_cm, 40, 250),
        neck_cm: number(m.neck_cm, 20, 80),
        hip_cm: number(m.hip_cm, 50, 250),
      },
      { onConflict: "user_id,logged_on" },
    );
    if (logError) return { ok: false, error: logError.message };
  }

  refresh();
  return { ok: true };
}

export async function deleteBodyLog(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("body_logs").delete().eq("id", id);
  refresh();
}

// Builds the next month of training from the saved profile.
export async function startNextBlock(
  startDate?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await authedClient();
  const { data: profile, error: profileError } = await supabase
    .from("body_profile")
    .select(
      "sex, age, height_cm, activity, goal, experience, days_per_week, equipment, session_minutes",
    )
    .maybeSingle<BodyProfile>();
  if (profileError) return { ok: false, error: profileError.message };
  if (!profile)
    return { ok: false, error: "Fill in your body details first." };

  const { count } = await supabase
    .from("gym_blocks")
    .select("id", { count: "exact", head: true });
  const number = (count ?? 0) + 1;
  const start = startDate && isValidDate(startDate) ? startDate : todayISO();
  const block = generateBlock(profile, number);

  const { data: saved, error } = await supabase
    .from("gym_blocks")
    .insert({
      name: block.name,
      start_date: start,
      weeks: 4,
      split: block.split,
      goal: profile.goal,
      level: profile.experience,
      days_per_week: profile.days_per_week,
      number,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  for (const day of block.days) {
    const { data: savedDay, error: dayError } = await supabase
      .from("gym_plan_days")
      .insert({
        block_id: saved.id,
        weekday: day.weekday,
        title: day.title,
        rest: day.rest,
      })
      .select("id")
      .single();
    if (dayError) return { ok: false, error: dayError.message };
    if (day.exercises.length === 0) continue;
    const { error: exError } = await supabase.from("gym_plan_exercises").insert(
      day.exercises.map((e, position) => ({
        day_id: savedDay.id,
        position,
        name: e.name,
        muscle: e.muscle,
        sets: e.sets,
        reps: e.reps,
        minutes: e.minutes,
        rest_seconds: e.rest_seconds,
        rir: e.rir,
        note: e.note,
      })),
    );
    if (exError) return { ok: false, error: exError.message };
  }

  refresh();
  return { ok: true, id: saved.id };
}
