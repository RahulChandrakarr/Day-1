import "server-only";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { addDays, categoryBreakdown, formatMonth, monthRange, totalsOf } from "@/lib/finance";
import { getTransactions } from "@/lib/finance-queries";
import { isoWeekday } from "@/lib/health";
import { loadHealthReport } from "@/lib/health-report";
import { getCurrentBlock, getGymCheckins, getGymPlan } from "@/lib/health-queries";
import { getJournalRange } from "@/lib/journal-queries";
import { getPlanYear } from "@/lib/plan-queries";
import { dateInput, monthInput, type Domain, type ToolContext } from "./common";
import { dayDetail } from "./daily";
import { finance } from "./finance";
import { habitsSummary } from "./health";
import { plan } from "./plan";

// Runs another section's tool from inside a report.
async function run(t: Tool, input: unknown) {
  return (t.execute as (i: unknown, o: unknown) => Promise<unknown>)(input, {
    toolCallId: "report",
    messages: [],
  });
}

function moneySummary(rows: Awaited<ReturnType<typeof getTransactions>>) {
  return {
    ...totalsOf(rows),
    topSpending: categoryBreakdown(rows, "expense")
      .slice(0, 5)
      .map((c) => ({ category: c.name, amount: c.amount })),
  };
}

async function weekReport(ctx: ToolContext, date: string) {
  const from = addDays(date, 1 - isoWeekday(date)); // Monday
  const to = addDays(from, 6);
  const upTo = to < ctx.today ? to : ctx.today;
  const prevFrom = addDays(from, -7);
  const prevTo = addDays(from, -1);

  const block = await getCurrentBlock();
  const [gymPlan, gym, prevGym, habits, money, prevMoney, journal, planYear] = await Promise.all([
    getGymPlan(block?.id ?? null),
    getGymCheckins(from, to),
    getGymCheckins(prevFrom, prevTo),
    habitsSummary(from, upTo, ctx.today),
    getTransactions({ from, to }),
    getTransactions({ from: prevFrom, to: prevTo }),
    getJournalRange(from, to),
    getPlanYear(Number(from.slice(0, 4))),
  ]);

  const trainingDays = gymPlan.filter((d) => !d.rest && d.exercises.length).map((d) => d.weekday);
  const plannedSoFar = Array.from({ length: 7 }, (_, i) => addDays(from, i)).filter(
    (d) => d <= upTo && trainingDays.includes(isoWeekday(d)),
  ).length;
  const sessions = (checkins: Record<string, string[]>) =>
    Object.values(checkins).filter((ids) => ids.length > 0).length;

  const todos = journal.flatMap((e) => e.priorities.filter((p) => p.text.trim()));
  const moods = journal.map((e) => e.mood).filter((m): m is number => m !== null);
  const dayTasks = planYear.items.filter(
    (i) => i.level === "day" && i.period >= from && i.period <= to,
  );

  return {
    week: { from, to, daysSoFar: Math.round((Date.parse(upTo) - Date.parse(from)) / 86_400_000) + 1 },
    gym: {
      workoutsDone: sessions(gym),
      plannedSoFar,
      plannedWholeWeek: trainingDays.length,
      exercisesTicked: Object.values(gym).reduce((n, ids) => n + ids.length, 0),
      workoutsWeekBefore: sessions(prevGym),
    },
    habits,
    money: { thisWeek: moneySummary(money), weekBefore: totalsOf(prevMoney) },
    todos: {
      done: todos.filter((t) => t.done).length,
      total: todos.length,
      stillOpen: todos.filter((t) => !t.done).map((t) => t.text).slice(0, 15),
    },
    journal: {
      daysWritten: journal.length,
      averageMood: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
      wins: journal.map((e) => e.wins).filter(Boolean).slice(0, 7),
    },
    planTasks: {
      done: dayTasks.filter((i) => i.done).length,
      total: dayTasks.length,
      open: dayTasks.filter((i) => !i.done).map((i) => `${i.period}: ${i.title}`).slice(0, 15),
    },
  };
}

export const reports: Domain = {
  labels: {
    daily_report: "Putting together your day…",
    weekly_report: "Putting together your week…",
    monthly_report: "Putting together the month…",
    pdf_link: "Preparing the PDF link…",
  },
  prompt: `REPORTS
- daily_report / weekly_report / monthly_report gather everything for a period. Weeks run Monday–Sunday.
- Write reports as short headed sections (e.g. **Workouts**, **Habits**, **Money**, **To-dos & plan**, **Mood**) with the key numbers bolded, what went well, what slipped, and 1–2 specific suggestions. Compare with the previous period when the data has it.
- pdf_link gives a download link for a PDF (plan, finance, health, journal). Put it in the answer as a markdown link.`,
  tools: (ctx) => {
    const planTools = plan.tools(ctx);
    const financeTools = finance.tools(ctx);
    return {
      daily_report: tool({
        description: "Everything about one day: to-dos, plan tasks, workout, habits, journal and money.",
        inputSchema: z.object({ date: dateInput }),
        execute: async ({ date }) => {
          const [day, planDay] = await Promise.all([
            dayDetail(date),
            run(planTools.get_plan, { scope: "day", date }),
          ]);
          return { ...day, plan: planDay };
        },
      }),

      weekly_report: tool({
        description:
          "A Monday–Sunday week (the week containing the date): workouts vs plan, habits, money vs the week before, to-dos, plan tasks and mood.",
        inputSchema: z.object({ date: dateInput.describe("Any day in the week") }),
        execute: async ({ date }) => weekReport(ctx, date),
      }),

      monthly_report: tool({
        description:
          "A month's report for one area: health (vs the month before), finance (totals, categories, plan vs actual), plan (goals and tasks) or journal (every day).",
        inputSchema: z.object({
          area: z.enum(["health", "finance", "plan", "journal"]),
          month: monthInput,
        }),
        execute: async ({ area, month }) => {
          if (area === "health") {
            const { report, previous, changes, nothingYet } = await loadHealthReport(month);
            return { month: formatMonth(month), nothingYet, report, previousMonth: previous, changes };
          }
          if (area === "plan") return run(planTools.get_plan, { scope: "month", month });
          const { from, to } = monthRange(month);
          if (area === "finance") {
            const [overview, budget] = await Promise.all([
              run(financeTools.get_finance_overview, { from, to }),
              run(financeTools.get_budget, { month }),
            ]);
            return { month: formatMonth(month), overview, plan: budget };
          }
          const days = await getJournalRange(from, to);
          return {
            month: formatMonth(month),
            days: days.map((e) => ({
              date: e.entry_date,
              mood: e.mood,
              energy: e.energy,
              todos: e.priorities.filter((p) => p.text.trim()),
              gratitude: e.gratitude.filter((g) => g.trim()),
              notes: e.notes.slice(0, 400),
              wins: e.wins,
              lessons: e.lessons,
            })),
          };
        },
      }),

      pdf_link: tool({
        description: "A download link for a PDF report. Plan and finance can be for a whole year.",
        inputSchema: z.object({
          kind: z.enum(["plan", "finance", "health", "journal"]),
          month: monthInput.optional(),
          year: z.number().int().min(2000).max(2200).optional(),
        }),
        execute: async ({ kind, month, year }) => {
          const byYear = year && !month && (kind === "plan" || kind === "finance");
          const period = byYear ? `year=${year}` : `month=${month ?? ctx.today.slice(0, 7)}`;
          const label = byYear ? String(year) : formatMonth(month ?? ctx.today.slice(0, 7));
          const url = `/api/reports/${kind}?${period}`;
          return { url, markdown: `[Download the ${kind} report for ${label} (PDF)](${url})` };
        },
      }),
    };
  },
};
