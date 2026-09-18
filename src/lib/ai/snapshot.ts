import "server-only";
import { APP_TIMEZONE, totalsOf } from "@/lib/finance";
import { blockWeek } from "@/lib/fitness";
import { exerciseTarget, streak } from "@/lib/health";
import { MOODS } from "@/lib/journal";
import { getBankAccounts } from "@/lib/finance-queries";
import { getJournalEntry } from "@/lib/journal-queries";
import { getOverview } from "@/lib/overview-query";
import { getPlanDay } from "@/lib/plan-queries";

// A compact picture of today that every answer starts with.
export async function todayCard(today: string) {
  const [overview, { entry, exists }, plan, banks] = await Promise.all([
    getOverview(),
    getJournalEntry(today),
    getPlanDay(today),
    getBankAccounts(today),
  ]);
  const weekday = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    timeZone: APP_TIMEZONE,
  }).format(new Date(`${today}T12:00:00Z`));

  const day = overview.planDay;
  const doneIds = new Set(overview.gymCheckins[today] ?? []);
  const todayTx = overview.transactions.filter((t) => t.occurred_on === today);
  const goalName = new Map(plan.goals.map((g) => [g.id, g.title]));
  const todos = entry.priorities.filter((p) => p.text.trim());

  return {
    date: today,
    weekday,
    todos: todos.map((t) => ({ text: t.text, done: t.done })),
    planTasks: plan.items.map((i) => ({
      id: i.id,
      title: i.title,
      goal: goalName.get(i.goal_id),
      done: i.done,
    })),
    activeGoals: plan.goalCount,
    workout: !day
      ? "No gym plan yet"
      : day.rest
        ? "Rest day"
        : {
            title: day.title,
            block: overview.block
              ? blockWeek(overview.block.start_date, today, overview.block.weeks)?.label ?? null
              : null,
            exercises: day.exercises.map((e) => ({
              name: e.name,
              target: exerciseTarget(e),
              done: doneIds.has(e.id),
            })),
          },
    habits: overview.habits.map((h) => {
      const own = overview.habitCheckins.filter((c) => c.habit_id === h.id);
      const c = own.find((x) => x.check_date === today);
      return {
        name: h.name,
        kind: h.kind,
        today: c ? (c.done ? "done" : "missed") : "not checked in",
        count: c?.count ?? null,
        countLabel: h.count_label,
        streak: streak(own, today),
      };
    }),
    journal: exists
      ? { written: true, mood: MOODS.find((m) => m.value === entry.mood)?.label ?? null }
      : { written: false },
    money: {
      today: totalsOf(todayTx),
      thisMonth: totalsOf(overview.transactions),
      // What is in their bank accounts right now (null when none are set up)
      netBalance: banks.length ? banks.reduce((sum, a) => sum + a.balance, 0) : null,
      bankAccounts: banks.map((a) => ({ name: a.name, balance: a.balance })),
      savingsWorth: overview.savingsWorth,
      youOwe: overview.balances.owe,
      owedToYou: overview.balances.owed,
    },
    latestWeightKg: overview.bodyLogs[overview.bodyLogs.length - 1]?.weight_kg ?? null,
  };
}
