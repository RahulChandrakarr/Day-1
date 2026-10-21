import "server-only";
import { addDays } from "@/lib/finance";
import {
  planStreak,
  weekOfMonth,
  weekPeriod,
  type Note,
  type PlanGoal,
  type PlanItem,
  type PlanProgress,
} from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

const num = (v: number | string | null) => (v === null ? null : Number(v));

// Goals for a year with every item and progress log, in three calls
export async function getPlanYear(year: number) {
  const supabase = await createClient();
  const [goals, items, logs] = await Promise.all([
    supabase
      .from("plan_goals")
      .select("id, year, title, emoji, notes, target_value, unit, start_month, end_month, position")
      .eq("year", year)
      .eq("archived", false)
      .order("position")
      .order("created_at"),
    supabase
      .from("plan_items")
      .select(
        "id, goal_id, level, period, title, notes, target_value, done, position, goal:plan_goals!inner(year)",
      )
      .eq("goal.year", year)
      .order("position")
      .order("created_at"),
    supabase
      .from("plan_progress")
      .select("id, goal_id, logged_on, amount, note")
      .gte("logged_on", `${year}-01-01`)
      .lte("logged_on", `${year}-12-31`)
      .order("logged_on"),
  ]);
  for (const r of [goals, items, logs]) if (r.error) throw new Error(r.error.message);

  return {
    goals: (goals.data ?? []).map(
      (g): PlanGoal => ({ ...g, target_value: num(g.target_value) }),
    ),
    items: (items.data ?? []).map(
      (i): PlanItem => ({
        id: i.id,
        goal_id: i.goal_id,
        level: i.level,
        period: i.period,
        title: i.title,
        notes: i.notes,
        target_value: num(i.target_value),
        done: i.done,
        position: i.position,
      }),
    ),
    logs: (logs.data ?? []).map(
      (l): PlanProgress => ({ ...l, amount: Number(l.amount) }),
    ),
  };
}

const PAYMENT_GOAL = "Clear loans and Odessa trip";

// Month checkboxes for the loan plan, across the years it runs.
export async function getPaymentChecklist(): Promise<{
  goals: PlanGoal[];
  items: PlanItem[];
}> {
  const supabase = await createClient();
  const goals = await supabase
    .from("plan_goals")
    .select("id, year, title, emoji, notes, target_value, unit, start_month, end_month, position")
    .eq("title", PAYMENT_GOAL)
    .eq("archived", false)
    .order("year");
  if (goals.error) throw new Error(goals.error.message);
  const ids = (goals.data ?? []).map((g) => g.id);
  if (ids.length === 0) return { goals: [], items: [] };
  const items = await supabase
    .from("plan_items")
    .select("id, goal_id, level, period, title, notes, target_value, done, position")
    .in("goal_id", ids)
    .eq("level", "month")
    .order("period")
    .order("position");
  if (items.error) throw new Error(items.error.message);
  return {
    goals: (goals.data ?? []).map(
      (g): PlanGoal => ({ ...g, target_value: num(g.target_value) }),
    ),
    items: (items.data ?? []).map(
      (i): PlanItem => ({
        ...i,
        target_value: num(i.target_value),
        notes: i.notes ?? "",
      }),
    ),
  };
}

export async function getNotes(): Promise<Note[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, body, pinned, created_at, updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNote(id: string): Promise<Note | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, body, pinned, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Today's tasks with their goal, for Overview and the journal
export async function getPlanDay(date: string) {
  const supabase = await createClient();
  const monthNumber = Number(date.slice(5, 7));
  const activeGoals = supabase
    .from("plan_goals")
    .select("id", { count: "exact", head: true })
    .eq("year", Number(date.slice(0, 4)))
    .eq("archived", false)
    .lte("start_month", monthNumber)
    .gte("end_month", monthNumber);
  const { data, error } = await supabase
    .from("plan_items")
    .select(
      "id, goal_id, level, period, title, notes, target_value, done, position, goal:plan_goals(id, year, title, emoji, notes, target_value, unit, start_month, end_month, position)",
    )
    .eq("level", "day")
    .eq("period", date)
    .order("position");
  if (error) throw new Error(error.message);
  const { count: goalCount } = await activeGoals;
  const rows = data ?? [];
  const goals = new Map<string, PlanGoal>();
  const items: PlanItem[] = rows.map((row) => {
    const goal = Array.isArray(row.goal) ? row.goal[0] : row.goal;
    if (goal)
      goals.set(goal.id, { ...goal, target_value: num(goal.target_value) });
    return {
      id: row.id,
      goal_id: row.goal_id,
      level: row.level,
      period: row.period,
      title: row.title,
      notes: row.notes,
      target_value: num(row.target_value),
      done: row.done,
      position: row.position,
    };
  });
  return { items, goals: [...goals.values()], goalCount: goalCount ?? 0 };
}

// Days in the recent window, so Overview can count a streak of finished plan days.
export async function getPlanStreak(today: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("period, done")
    .eq("level", "day")
    .gte("period", addDays(today, -120))
    .lte("period", today);
  if (error) throw new Error(error.message);
  const byDate = new Map<string, { date: string; total: number; done: number }>();
  for (const row of data ?? []) {
    const current = byDate.get(row.period) ?? { date: row.period, total: 0, done: 0 };
    current.total += 1;
    if (row.done) current.done += 1;
    byDate.set(row.period, current);
  }
  return planStreak([...byDate.values()], today);
}

export async function getPlanReflection(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_reflections")
    .select("answers")
    .eq("logged_on", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const answers = (data?.answers ?? []) as string[];
  return [0, 1, 2, 3, 4].map((i) => answers[i] ?? "");
}

export async function getPlanCoverage(today: string) {
  const supabase = await createClient();
  const tomorrow = addDays(today, 1);
  const week = weekPeriod(today.slice(0, 7), weekOfMonth(today));
  const { data, error } = await supabase
    .from("plan_items")
    .select("level, period")
    .in("period", [week, tomorrow]);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return {
    hasWeekItem: rows.some((row) => row.level === "week" && row.period === week),
    hasTomorrow: rows.some((row) => row.level === "day" && row.period === tomorrow),
  };
}
