import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  addItem,
  deleteGoal,
  deleteItem,
  deleteNote,
  logProgress,
  saveGoal,
  saveNote,
  splitGoalByMonth,
  splitMonthByWeek,
  updateItem,
} from "@/app/(dashboard)/plan/actions";
import { getNotes, getPlanDay, getPlanYear } from "@/lib/plan-queries";
import {
  goalActiveIn,
  goalElapsed,
  goalProgress,
  itemsIn,
  MONTH_NAMES,
  periodTarget,
  weekOfMonth,
  weekRange,
  type PlanGoal,
} from "@/lib/plans";
import {
  changed,
  confirmedInput,
  dateInput,
  failed,
  idInput,
  monthInput,
  NEEDS_CONFIRMATION,
  pick,
  type Domain,
} from "./common";

const pct = (ratio: number | null) => (ratio === null ? null : Math.round(ratio * 100));

async function findGoal(query: string, year: number) {
  const { goals } = await getPlanYear(year);
  return pick(goals, query, (g) => g.title);
}

// Periods: month YYYY-MM, week YYYY-MM-wN, day YYYY-MM-DD
const periodInput = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])(-w[1-4]|-\d{2})?$/)
  .describe("YYYY-MM for a month task, YYYY-MM-wN (N=1..4) for a week task, YYYY-MM-DD for a day task");

const levelOf = (period: string) =>
  /-w[1-4]$/.test(period) ? "week" : period.length === 10 ? "day" : "month";

function goalShape(goal: PlanGoal) {
  return {
    id: goal.id,
    title: goal.title,
    emoji: goal.emoji,
    months: `${MONTH_NAMES[goal.start_month - 1]}–${MONTH_NAMES[goal.end_month - 1]} ${goal.year}`,
    target: goal.target_value,
    unit: goal.unit,
    notes: goal.notes || null,
  };
}

export const plan: Domain = {
  labels: {
    get_plan: "Opening your plan…",
    search_notes: "Searching your notes…",
    create_goal: "Adding the goal…",
    add_plan_task: "Adding to your plan…",
    update_plan_task: "Updating your plan…",
    log_goal_progress: "Logging your progress…",
    split_goal: "Splitting the goal…",
    save_note: "Saving the note…",
    delete_goal: "Removing the goal…",
    delete_plan_task: "Removing the task…",
    delete_note: "Removing the note…",
  },
  prompt: `PLAN (goals → month → week → day tasks, and notes)
- Yearly goals run between a start and end month and may have a number target (e.g. ₹2,00,000 saved, 12 books). Progress follows logged amounts when there's a target, otherwise ticked tasks.
- Plan weeks are fixed chunks of the month: w1 = days 1–7, w2 = 8–14, w3 = 15–21, w4 = 22–end. Today's plan week is given in get_plan output.
- Task periods: YYYY-MM (month), YYYY-MM-wN (week), YYYY-MM-DD (day). "Today's plan" = day tasks for today.
- Goals can be named by title; task ids come from get_plan. Use split_goal to spread a target across months or a month across its 4 weeks.
- "behind" means progress is below the share of time elapsed.`,
  tools: (ctx) => ({
    get_plan: tool({
      description:
        "The plan for a year, month, week or day: goals with progress %, amount vs target for the period, and the tasks in that period (with ids).",
      inputSchema: z.object({
        scope: z.enum(["year", "month", "week", "day"]),
        year: z.number().int().min(2000).max(2200).optional(),
        month: monthInput.optional(),
        week: z.number().int().min(1).max(4).optional().describe("Plan week 1-4 of the month"),
        date: dateInput.optional(),
      }),
      execute: async ({ scope, year, month, week, date }) => {
        const day = date ?? ctx.today;
        const m = month ?? day.slice(0, 7);
        const y = year ?? Number(m.slice(0, 4));
        if (scope === "day") {
          const { items, goals } = await getPlanDay(day);
          const name = new Map(goals.map((g) => [g.id, `${g.emoji} ${g.title}`]));
          return {
            date: day,
            tasks: items.map((i) => ({
              id: i.id,
              title: i.title,
              goal: name.get(i.goal_id),
              done: i.done,
              target: i.target_value,
            })),
          };
        }
        const { goals: all, items, logs } = await getPlanYear(y);
        const w = scope === "week" ? (week ?? weekOfMonth(day)) : undefined;
        const periodScope =
          scope === "year" ? {} : scope === "month" ? { month: m } : { month: m, week: w };
        const goals = scope === "year" ? all : all.filter((g) => goalActiveIn(g, m));
        return {
          scope,
          period:
            scope === "year" ? String(y) : scope === "month" ? m : { month: m, week: w, ...weekRange(m, w!) },
          todayPlanWeek: { month: ctx.today.slice(0, 7), week: weekOfMonth(ctx.today) },
          goals: goals.map((goal) => {
            const progress = goalProgress(goal, items, logs, periodScope);
            const tasks = itemsIn(
              items.filter((i) => i.goal_id === goal.id),
              periodScope,
            );
            const elapsed = scope === "year" ? goalElapsed(goal, ctx.today) : null;
            return {
              ...goalShape(goal),
              progressPct: pct(progress.ratio),
              amountLogged: progress.amount,
              targetForPeriod: periodTarget(goal, items, periodScope),
              tasksDone: progress.done,
              tasksTotal: progress.total,
              timeElapsedPct: elapsed === null ? null : pct(elapsed),
              behind:
                elapsed !== null && progress.ratio !== null && progress.ratio + 0.05 < elapsed,
              tasks: tasks.slice(0, 40).map((i) => ({
                id: i.id,
                title: i.title,
                period: i.period,
                done: i.done,
                target: i.target_value,
              })),
            };
          }),
        };
      },
    }),

    search_notes: tool({
      description: "The user's notes (Plan → Notes), optionally filtered by words in the title or body.",
      inputSchema: z.object({ query: z.string().max(80).optional() }),
      execute: async ({ query }) => {
        const q = query?.toLowerCase();
        const notes = (await getNotes()).filter(
          (n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
        );
        return {
          count: notes.length,
          notes: notes.slice(0, 20).map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body.slice(0, 1500),
            pinned: n.pinned,
            updated: n.updated_at.slice(0, 10),
          })),
        };
      },
    }),

    create_goal: tool({
      description: "Create a yearly goal (optionally with a number target and a month range).",
      inputSchema: z.object({
        title: z.string().min(1).max(80),
        year: z.number().int().min(2000).max(2200),
        emoji: z.string().max(8).optional(),
        target: z.number().positive().optional(),
        unit: z.string().max(20).optional().describe("e.g. ₹, books, km"),
        startMonth: z.number().int().min(1).max(12).default(1),
        endMonth: z.number().int().min(1).max(12).default(12),
        notes: z.string().max(2000).optional(),
      }),
      execute: async (input) => {
        const result = await saveGoal({
          year: input.year,
          title: input.title,
          emoji: input.emoji,
          notes: input.notes,
          target_value: input.target ?? null,
          unit: input.unit ?? null,
          start_month: input.startMonth,
          end_month: input.endMonth,
        });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Created goal "${input.title}" (${MONTH_NAMES[input.startMonth - 1]}–${MONTH_NAMES[input.endMonth - 1]} ${input.year}).`, {
          goalId: result.id,
        });
      },
    }),

    add_plan_task: tool({
      description: "Add tasks under a goal for a month, plan week or day.",
      inputSchema: z.object({
        goal: z.string().min(1).describe("Goal title or id"),
        period: periodInput,
        titles: z.array(z.string().min(1).max(200)).min(1).max(20),
        target: z.number().positive().optional().describe("Optional number for the task, in the goal's unit"),
      }),
      execute: async ({ goal, period, titles, target }) => {
        const found = await findGoal(goal, Number(period.slice(0, 4)));
        if ("error" in found) return failed(found.error);
        const level = levelOf(period);
        for (const title of titles) {
          const result = await addItem({
            goalId: found.item.id,
            level,
            period,
            title,
            target_value: target ?? null,
          });
          if (!result.ok) return failed(result.error);
        }
        return changed(ctx, `Added to "${found.item.title}" for ${period}: ${titles.join("; ")}`);
      },
    }),

    update_plan_task: tool({
      description: "Tick, untick, rename or change the target of a plan task (id from get_plan).",
      inputSchema: z.object({
        id: idInput,
        done: z.boolean().optional(),
        title: z.string().min(1).max(200).optional(),
        target: z.number().positive().nullable().optional(),
      }),
      execute: async ({ id, done, title, target }) => {
        const result = await updateItem(id, { done, title, target_value: target });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Task updated${done !== undefined ? (done ? " (done)" : " (not done)") : ""}.`);
      },
    }),

    log_goal_progress: tool({
      description: "Log an amount toward a goal's number target (e.g. saved ₹5,000, read 2 books).",
      inputSchema: z.object({
        goal: z.string().min(1),
        amount: z.number(),
        date: dateInput,
        note: z.string().max(200).optional(),
      }),
      execute: async ({ goal, amount, date, note }) => {
        const found = await findGoal(goal, Number(date.slice(0, 4)));
        if ("error" in found) return failed(found.error);
        if (!found.item.target_value) return failed(`"${found.item.title}" has no number target; tick its tasks instead.`);
        const result = await logProgress({ goalId: found.item.id, amount, date, note });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Logged ${amount} ${found.item.unit ?? ""} toward "${found.item.title}" on ${date}.`);
      },
    }),

    split_goal: tool({
      description:
        "Auto-split a goal: 'months' spreads the target (or creates monthly milestones) from a month onward; 'weeks' splits one month into its 4 plan weeks.",
      inputSchema: z.object({
        goal: z.string().min(1),
        mode: z.enum(["months", "weeks"]),
        month: monthInput.describe("For 'months': first month to split from. For 'weeks': the month to split."),
      }),
      execute: async ({ goal, mode, month }) => {
        const found = await findGoal(goal, Number(month.slice(0, 4)));
        if ("error" in found) return failed(found.error);
        const result =
          mode === "months"
            ? await splitGoalByMonth(found.item.id, month)
            : await splitMonthByWeek(found.item.id, month);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Split "${found.item.title}" into ${mode === "months" ? `months from ${month}` : `4 weeks of ${month}`}.`);
      },
    }),

    save_note: tool({
      description: "Create a note, or update one by id (from search_notes).",
      inputSchema: z.object({
        id: idInput.optional(),
        title: z.string().max(120).default(""),
        body: z.string().max(50000).default(""),
        pinned: z.boolean().optional(),
      }),
      execute: async ({ id, title, body, pinned }) => {
        const result = await saveNote({ id, title, body, pinned });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `${id ? "Updated" : "Saved"} note${title ? ` "${title}"` : ""}.`, { noteId: result.id });
      },
    }),

    delete_goal: tool({
      description: "Delete a goal with all its tasks and progress. Confirm with the user first.",
      inputSchema: z.object({
        goal: z.string().min(1),
        year: z.number().int().min(2000).max(2200),
        confirmed: confirmedInput,
      }),
      execute: async ({ goal, year, confirmed }) => {
        const found = await findGoal(goal, year);
        if ("error" in found) return failed(found.error);
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldDelete: found.item.title };
        const result = await deleteGoal(found.item.id);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Deleted goal "${found.item.title}".`);
      },
    }),

    delete_plan_task: tool({
      description: "Delete a plan task by id. Confirm with the user first.",
      inputSchema: z.object({ id: idInput, title: z.string().optional(), confirmed: confirmedInput }),
      execute: async ({ id, title, confirmed }) => {
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldDelete: title ?? id };
        const result = await deleteItem(id);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Deleted task${title ? ` "${title}"` : ""}.`);
      },
    }),

    delete_note: tool({
      description: "Delete a note by id. Confirm with the user first.",
      inputSchema: z.object({ id: idInput, title: z.string().optional(), confirmed: confirmedInput }),
      execute: async ({ id, title, confirmed }) => {
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldDelete: title ?? id };
        const result = await deleteNote(id);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Deleted note${title ? ` "${title}"` : ""}.`);
      },
    }),
  }),
};
