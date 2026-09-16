import "server-only";
import type { DebtEntry } from "@/lib/debts";
import { monthRange, todayISO, type Transaction } from "@/lib/finance";
import type { InvestmentEntry } from "@/lib/investments";
import { isoWeekday, type HabitCheckin, type PlanDay } from "@/lib/health";
import type { Habit } from "@/lib/journal";
import { createClient } from "@/lib/supabase/server";

export type OverviewData = {
  transactions: Transaction[];
  balances: { owe: number; owed: number };
  savingsWorth: number;
  savedThisMonth: number;
  debtsToday: DebtEntry[];
  investmentsToday: (InvestmentEntry & { accountName: string; color: number })[];
  journalToday: boolean;
  moods: { entry_date: string; mood: number | null; energy: number | null }[];
  bodyLogs: { logged_on: string; weight_kg: number }[];
  block: { id: string; name: string; start_date: string; weeks: number } | null;
  planDay: PlanDay | null;
  gymCheckins: Record<string, string[]>;
  habits: Habit[];
  habitCheckins: HabitCheckin[];
};

type Snapshot = {
  transactions: (Omit<Transaction, "amount"> & { amount: number | string })[];
  balances: { owe: number | string; owed: number | string };
  savings_worth: number | string;
  saved_this_month: number | string;
  debts_today: (Omit<DebtEntry, "amount"> & { amount: number | string })[];
  investments_today: (Omit<InvestmentEntry, "amount"> & {
    amount: number | string;
    account_name: string;
    color: number;
  })[];
  journal_today: boolean;
  moods: OverviewData["moods"];
  body_logs: { logged_on: string; weight_kg: number | string }[];
  block: OverviewData["block"];
  plan_day: (Omit<PlanDay, "exercises"> & {
    exercises: (PlanDay["exercises"][number] & {
      weight_kg: number | string | null;
    })[];
  }) | null;
  gym_checkins: Record<string, string[]>;
  habits: Habit[];
  habit_checkins: HabitCheckin[];
};

const num = (value: number | string) => Number(value);

// One database call for the whole Overview page.
export async function getOverview(): Promise<OverviewData> {
  const today = todayISO();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("overview_snapshot", {
    p_today: today,
    p_month_start: monthRange(today.slice(0, 7)).from,
    p_weekday: isoWeekday(today),
  });
  if (error) throw new Error(error.message);
  const snapshot = data as Snapshot;

  return {
    transactions: snapshot.transactions.map((t) => ({
      ...t,
      amount: num(t.amount),
    })),
    balances: {
      owe: num(snapshot.balances.owe),
      owed: num(snapshot.balances.owed),
    },
    savingsWorth: num(snapshot.savings_worth),
    savedThisMonth: num(snapshot.saved_this_month),
    debtsToday: snapshot.debts_today.map((d) => ({
      ...d,
      amount: num(d.amount),
    })),
    investmentsToday: snapshot.investments_today.map((e) => ({
      ...e,
      amount: num(e.amount),
      accountName: e.account_name,
    })),
    journalToday: snapshot.journal_today,
    moods: snapshot.moods,
    bodyLogs: snapshot.body_logs.map((b) => ({
      ...b,
      weight_kg: num(b.weight_kg),
    })),
    block: snapshot.block,
    planDay: snapshot.plan_day
      ? {
          ...snapshot.plan_day,
          exercises: snapshot.plan_day.exercises.map((e) => ({
            ...e,
            weight_kg: e.weight_kg === null ? null : num(e.weight_kg),
          })),
        }
      : null,
    gymCheckins: snapshot.gym_checkins ?? {},
    habits: snapshot.habits,
    habitCheckins: snapshot.habit_checkins,
  };
}
