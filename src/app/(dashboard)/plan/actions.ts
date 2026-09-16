"use server";

import { revalidatePath } from "next/cache";
import { isValidDate } from "@/lib/finance";
import { splitAcrossMonths, weekRange, WEEKS, type PlanLevel } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const uuid = /^[0-9a-f-]{36}$/i;
const LEVELS: PlanLevel[] = ["month", "week", "day"];

async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new Error("Not signed in.");
  return supabase;
}

function refresh() {
  revalidatePath("/plan", "layout");
  revalidatePath("/");
  revalidatePath("/daily");
}

const clean = (value: unknown, max: number) =>
  String(value ?? "").trim().slice(0, max);

const amountOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : null;
};

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------
export async function saveGoal(input: {
  id?: string;
  year: number;
  title: string;
  emoji?: string;
  notes?: string;
  target_value?: number | string | null;
  unit?: string | null;
  start_month?: number;
  end_month?: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = clean(input.title, 80);
  if (!title) return { ok: false, error: "Give the goal a name." };
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2200)
    return { ok: false, error: "Invalid year." };
  const target = amountOrNull(input.target_value);
  const startMonth = Number(input.start_month ?? 1);
  const endMonth = Number(input.end_month ?? 12);
  if (
    !Number.isInteger(startMonth) ||
    !Number.isInteger(endMonth) ||
    startMonth < 1 ||
    endMonth > 12 ||
    startMonth > endMonth
  )
    return { ok: false, error: "The end month must come after the start month." };
  const row = {
    start_month: startMonth,
    end_month: endMonth,
    year,
    title,
    emoji: clean(input.emoji, 8) || "🎯",
    notes: String(input.notes ?? "").slice(0, 20000),
    target_value: target && target > 0 ? target : null,
    unit: target ? clean(input.unit, 16) || null : null,
    updated_at: new Date().toISOString(),
  };

  const supabase = await authedClient();
  if (input.id) {
    if (!uuid.test(input.id)) return { ok: false, error: "Unknown goal." };
    const { error } = await supabase.from("plan_goals").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id: input.id };
  }
  const { count } = await supabase
    .from("plan_goals")
    .select("id", { count: "exact", head: true })
    .eq("year", year);
  const { data, error } = await supabase
    .from("plan_goals")
    .insert({ ...row, position: count ?? 0 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteGoal(id: string): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown goal." };
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_goals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Even monthly targets for what's left of the number, from a month onward
export async function splitGoalByMonth(goalId: string, fromMonth: string): Promise<Result> {
  if (!uuid.test(goalId) || !/^\d{4}-\d{2}$/.test(fromMonth))
    return { ok: false, error: "Invalid request." };
  const supabase = await authedClient();
  const { data: goal, error } = await supabase
    .from("plan_goals")
    .select("id, year, title, emoji, notes, target_value, unit, start_month, end_month, position")
    .eq("id", goalId)
    .single();
  if (error || !goal) return { ok: false, error: error?.message ?? "Unknown goal." };
  if (!goal.target_value)
    return { ok: false, error: "Add a number to reach first." };

  const { data: logs } = await supabase
    .from("plan_progress")
    .select("amount, logged_on")
    .eq("goal_id", goalId)
    .lt("logged_on", `${fromMonth}-01`);
  const logged = (logs ?? []).reduce((s, l) => s + Number(l.amount), 0);
  const split = splitAcrossMonths(
    { ...goal, target_value: Number(goal.target_value) },
    logged,
    fromMonth,
  );
  if (split.length === 0)
    return { ok: false, error: "This goal has no months left to split into." };
  const unit = goal.unit ?? "";

  // Replace existing month targets from this month on
  await supabase
    .from("plan_items")
    .delete()
    .eq("goal_id", goalId)
    .eq("level", "month")
    .gte("period", fromMonth)
    .not("target_value", "is", null);

  const { error: insertError } = await supabase.from("plan_items").insert(
    split.map(({ month, target }, position) => ({
      goal_id: goalId,
      level: "month",
      period: month,
      title: `${unit === "₹" ? "₹" : ""}${target.toLocaleString("en-IN")}${unit && unit !== "₹" ? ` ${unit}` : ""} toward ${goal.title}`,
      target_value: target,
      position,
    })),
  );
  if (insertError) return { ok: false, error: insertError.message };
  refresh();
  return { ok: true };
}

// Four weekly targets from a month's target
export async function splitMonthByWeek(goalId: string, month: string): Promise<Result> {
  if (!uuid.test(goalId) || !/^\d{4}-\d{2}$/.test(month))
    return { ok: false, error: "Invalid request." };
  const supabase = await authedClient();
  const [{ data: goal }, { data: monthItems }] = await Promise.all([
    supabase
      .from("plan_goals")
      .select("title, target_value, unit, start_month, end_month")
      .eq("id", goalId)
      .single(),
    supabase
      .from("plan_items")
      .select("target_value")
      .eq("goal_id", goalId)
      .eq("level", "month")
      .eq("period", month),
  ]);
  if (!goal) return { ok: false, error: "Unknown goal." };
  const monthTarget =
    (monthItems ?? []).reduce((s, i) => s + Number(i.target_value ?? 0), 0) ||
    (goal.target_value
      ? Number(goal.target_value) / (goal.end_month - goal.start_month + 1)
      : 0);
  if (!monthTarget)
    return { ok: false, error: "Set this month's target first." };

  await supabase
    .from("plan_items")
    .delete()
    .eq("goal_id", goalId)
    .eq("level", "week")
    .like("period", `${month}-w%`)
    .not("target_value", "is", null);

  const share = Math.round((monthTarget / 4) * 100) / 100;
  const unit = goal.unit ?? "";
  const { error } = await supabase.from("plan_items").insert(
    WEEKS.map((week, position) => {
      const { from, to } = weekRange(month, week);
      return {
        goal_id: goalId,
        level: "week",
        period: `${month}-w${week}`,
        title: `${unit === "₹" ? "₹" : ""}${share.toLocaleString("en-IN")}${unit && unit !== "₹" ? ` ${unit}` : ""} (${from.slice(8)}–${to.slice(8)})`,
        target_value: share,
        position,
      };
    }),
  );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Items: month targets, week targets, day tasks
// ---------------------------------------------------------------------------
export async function addItem(input: {
  goalId: string;
  level: PlanLevel;
  period: string;
  title: string;
  target_value?: number | string | null;
}): Promise<Result> {
  if (!uuid.test(input.goalId) || !LEVELS.includes(input.level))
    return { ok: false, error: "Invalid item." };
  const title = clean(input.title, 200);
  if (!title) return { ok: false, error: "Write what needs doing." };
  if (input.level === "day" && !isValidDate(input.period))
    return { ok: false, error: "Invalid day." };
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_items").insert({
    goal_id: input.goalId,
    level: input.level,
    period: input.period,
    title,
    target_value: amountOrNull(input.target_value),
    position: Date.now() % 1_000_000,
  });
  if (error)
    return {
      ok: false,
      error: error.message.includes("period_format") ? "Invalid period." : error.message,
    };
  refresh();
  return { ok: true };
}

export async function updateItem(
  id: string,
  patch: { title?: string; notes?: string; target_value?: number | string | null; done?: boolean },
): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown item." };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const title = clean(patch.title, 200);
    if (!title) return { ok: false, error: "Title can't be empty." };
    row.title = title;
  }
  if (patch.notes !== undefined) row.notes = String(patch.notes).slice(0, 4000);
  if (patch.target_value !== undefined) row.target_value = amountOrNull(patch.target_value);
  if (patch.done !== undefined) {
    row.done = Boolean(patch.done);
    row.done_at = patch.done ? new Date().toISOString() : null;
  }
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_items").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteItem(id: string): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown item." };
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Progress toward a goal's number
// ---------------------------------------------------------------------------
export async function logProgress(input: {
  goalId: string;
  amount: number | string;
  date: string;
  note?: string;
}): Promise<Result> {
  if (!uuid.test(input.goalId) || !isValidDate(input.date))
    return { ok: false, error: "Invalid entry." };
  const amount = Number(String(input.amount).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) >= 1e12)
    return { ok: false, error: "Enter an amount." };
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_progress").insert({
    goal_id: input.goalId,
    amount: Math.round(amount * 100) / 100,
    logged_on: input.date,
    note: clean(input.note, 200),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteProgress(id: string): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown entry." };
  const supabase = await authedClient();
  const { error } = await supabase.from("plan_progress").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export async function saveNote(input: {
  id?: string;
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = clean(input.title, 120);
  const body = String(input.body ?? "").slice(0, 50000);
  if (!title && !body.trim()) return { ok: false, error: "The note is empty." };
  const supabase = await authedClient();
  const row = {
    title,
    body,
    ...(input.pinned === undefined ? {} : { pinned: Boolean(input.pinned) }),
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    if (!uuid.test(input.id)) return { ok: false, error: "Unknown note." };
    const { error } = await supabase.from("notes").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/plan/notes");
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase.from("notes").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plan/notes");
  return { ok: true, id: data.id };
}

export async function setNotePinned(id: string, pinned: boolean): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown note." };
  const supabase = await authedClient();
  const { error } = await supabase.from("notes").update({ pinned }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plan/notes");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown note." };
  const supabase = await authedClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plan/notes");
  return { ok: true };
}
