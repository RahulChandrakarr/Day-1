import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  addTodos,
  appendJournalNote,
  replaceTodos,
  setTodoDone,
} from "@/app/(dashboard)/daily/actions";
import { addDays, totalsOf } from "@/lib/finance";
import { getTransactions } from "@/lib/finance-queries";
import { isoWeekday, reasonLabel } from "@/lib/health";
import {
  getCurrentBlock,
  getGymCheckins,
  getGymPlan,
  getHabitCheckins,
} from "@/lib/health-queries";
import { ENERGY, MOODS } from "@/lib/journal";
import { getHabits, getJournalEntry, getJournalRange } from "@/lib/journal-queries";
import { getPlanDay } from "@/lib/plan-queries";
import {
  changed,
  confirmedInput,
  dateInput,
  failed,
  NEEDS_CONFIRMATION,
  type Domain,
} from "./common";

const moodLabel = (value: number | null) =>
  MOODS.find((m) => m.value === value)?.label ?? null;
const energyLabel = (value: number | null) => (value ? ENERGY[value - 1] : null);

// Everything about one day, used by the daily tools and the daily report.
export async function dayDetail(date: string) {
  const [{ entry, exists }, habits, checkins, block, gymCheckins, plan, money] =
    await Promise.all([
      getJournalEntry(date),
      getHabits(),
      getHabitCheckins(date, date),
      getCurrentBlock(),
      getGymCheckins(date, date),
      getPlanDay(date),
      getTransactions({ from: date, to: date }),
    ]);
  const gymPlan = await getGymPlan(block?.id ?? null);
  const gymDay = gymPlan.find((d) => d.weekday === isoWeekday(date));
  const done = new Set(gymCheckins[date] ?? []);
  const todos = entry.priorities.filter((p) => p.text.trim());
  const goalName = new Map(plan.goals.map((g) => [g.id, g.title]));

  return {
    date,
    journal: exists
      ? {
          mood: moodLabel(entry.mood),
          energy: energyLabel(entry.energy),
          gratitude: entry.gratitude.filter((g) => g.trim()),
          notes: entry.notes,
          wins: entry.wins,
          lessons: entry.lessons,
          tomorrow: entry.tomorrow,
        }
      : null,
    todos: todos.map((t) => ({ text: t.text, done: t.done })),
    planTasks: plan.items.map((i) => ({
      id: i.id,
      title: i.title,
      goal: goalName.get(i.goal_id) ?? null,
      done: i.done,
      target: i.target_value,
    })),
    gym: gymDay
      ? gymDay.rest
        ? { rest: true, title: gymDay.title || "Rest day" }
        : {
            rest: false,
            title: gymDay.title,
            exercises: gymDay.exercises.map((e) => ({
              name: e.name,
              done: done.has(e.id),
            })),
            doneCount: gymDay.exercises.filter((e) => done.has(e.id)).length,
          }
      : null,
    habits: habits.map((h) => {
      const c = checkins.find((x) => x.habit_id === h.id);
      return {
        name: h.name,
        kind: h.kind,
        status: c ? (c.done ? "done" : "missed") : "not checked in",
        count: c?.count ?? null,
        countLabel: h.count_label,
        reason: c?.reason ? reasonLabel(c.reason) : null,
        note: c?.note || null,
      };
    }),
    money: {
      ...totalsOf(money),
      entries: money.map((t) => ({
        type: t.type,
        amount: t.amount,
        category: t.category?.name ?? null,
        description: t.description,
      })),
    },
  };
}

async function todosFor(date: string) {
  const { entry } = await getJournalEntry(date);
  return entry.priorities.filter((p) => p.text.trim());
}

export const daily: Domain = {
  labels: {
    get_day: "Looking at your day…",
    get_days: "Looking back over those days…",
    add_todos: "Adding your to-dos…",
    set_todo_done: "Updating your to-do list…",
    remove_todos: "Updating your to-do list…",
    set_todos: "Rewriting your to-do list…",
    add_journal_note: "Writing in your journal…",
  },
  prompt: `DAILY (journal & to-dos)
- To-dos and the journal's "priorities" are the same list, stored per day. "My to-do list" means today's unless another day is named.
- get_day gives one day's journal, to-dos, plan tasks, workout, habit check-ins and money. get_days covers a range (max 31 days) for "how was my week".
- add_todos appends; set_todos replaces the whole list (it needs confirmed:true when it would drop unfinished items); remove_todos deletes named items (confirm first).
- Mood is 1–5 (1 Rough, 2 Low, 3 Okay, 4 Good, 5 Great). add_journal_note appends to the day's notes and can set the mood.`,
  tools: (ctx) => ({
    get_day: tool({
      description:
        "One day in full: journal (mood, energy, gratitude, notes, wins, lessons, tomorrow), to-do list, plan tasks, workout, habit check-ins and money.",
      inputSchema: z.object({ date: dateInput }),
      execute: async ({ date }) => dayDetail(date),
    }),

    get_days: tool({
      description:
        "Summary per day for a range (max 31 days): mood, energy, to-dos done, journal notes, workouts, habits kept, money spent.",
      inputSchema: z.object({ from: dateInput, to: dateInput }),
      execute: async ({ from, to }) => {
        if (to < from) return failed("'to' is before 'from'.");
        if (to > addDays(from, 30)) return failed("Use at most 31 days.");
        const [entries, checkins, gym, money] = await Promise.all([
          getJournalRange(from, to),
          getHabitCheckins(from, to),
          getGymCheckins(from, to),
          getTransactions({ from, to }),
        ]);
        const days: object[] = [];
        for (let d = from; d <= to; d = addDays(d, 1)) {
          const e = entries.find((x) => x.entry_date === d);
          const todos = e?.priorities.filter((p) => p.text.trim()) ?? [];
          const dayChecks = checkins.filter((c) => c.check_date === d);
          const spend = totalsOf(money.filter((t) => t.occurred_on === d));
          days.push({
            date: d,
            mood: moodLabel(e?.mood ?? null),
            energy: energyLabel(e?.energy ?? null),
            todos: todos.length
              ? `${todos.filter((t) => t.done).length}/${todos.length} done`
              : null,
            openTodos: todos.filter((t) => !t.done).map((t) => t.text),
            notes: e?.notes ? e.notes.slice(0, 300) : null,
            wins: e?.wins || null,
            exercisesDone: (gym[d] ?? []).length,
            habitsDone: dayChecks.filter((c) => c.done).length,
            habitsMissed: dayChecks.filter((c) => !c.done).length,
            spent: spend.expense,
            earned: spend.income,
          });
        }
        return { from, to, days };
      },
    }),

    add_todos: tool({
      description: "Add one or more to-dos to a day's list (today unless the user names a day).",
      inputSchema: z.object({
        items: z.array(z.string().min(1).max(200)).min(1).max(20),
        date: dateInput,
      }),
      execute: async ({ items, date }) => {
        const result = await addTodos(items, date);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Added ${items.length} to-do(s) for ${date}: ${items.join("; ")}`);
      },
    }),

    set_todo_done: tool({
      description: "Tick (or untick) to-dos on a day's list, matched by their text.",
      inputSchema: z.object({
        items: z.array(z.string().min(1)).min(1).max(20),
        date: dateInput,
        done: z.boolean().default(true),
      }),
      execute: async ({ items, date, done }) => {
        const todos = await todosFor(date);
        const updated: string[] = [];
        const missing: string[] = [];
        for (const query of items) {
          const q = query.toLowerCase();
          const index = todos.findIndex(
            (t) => t.text.toLowerCase() === q || t.text.toLowerCase().includes(q),
          );
          if (index < 0) {
            missing.push(query);
            continue;
          }
          const result = await setTodoDone(date, index, todos[index].text, done);
          if (result.ok) updated.push(todos[index].text);
          else missing.push(query);
        }
        if (!updated.length)
          return failed(`No matching to-dos. The list is: ${todos.map((t) => t.text).join("; ") || "empty"}`);
        return changed(ctx, `Marked ${done ? "done" : "not done"}: ${updated.join("; ")}`, {
          notFound: missing,
        });
      },
    }),

    remove_todos: tool({
      description: "Delete to-dos from a day's list, matched by text. Confirm with the user first.",
      inputSchema: z.object({
        items: z.array(z.string().min(1)).min(1).max(20),
        date: dateInput,
        confirmed: confirmedInput,
      }),
      execute: async ({ items, date, confirmed }) => {
        const todos = await todosFor(date);
        const drop = todos.filter((t) =>
          items.some((q) => t.text.toLowerCase().includes(q.toLowerCase())),
        );
        if (!drop.length)
          return failed(`No matching to-dos. The list is: ${todos.map((t) => t.text).join("; ") || "empty"}`);
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldRemove: drop.map((t) => t.text) };
        const result = await replaceTodos(todos.filter((t) => !drop.includes(t)), date);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Removed: ${drop.map((t) => t.text).join("; ")}`);
      },
    }),

    set_todos: tool({
      description:
        "Replace a day's whole to-do list with this list, in order. Needs confirmed:true if unfinished existing to-dos would be dropped.",
      inputSchema: z.object({
        items: z
          .array(z.object({ text: z.string().min(1).max(200), done: z.boolean().default(false) }))
          .max(50),
        date: dateInput,
        confirmed: confirmedInput,
      }),
      execute: async ({ items, date, confirmed }) => {
        const todos = await todosFor(date);
        const dropped = todos.filter(
          (t) => !t.done && !items.some((i) => i.text.toLowerCase() === t.text.toLowerCase()),
        );
        if (dropped.length && !confirmed)
          return { ...NEEDS_CONFIRMATION, wouldDrop: dropped.map((t) => t.text) };
        const result = await replaceTodos(items, date);
        if (!result.ok) return failed(result.error);
        return changed(ctx, `To-do list for ${date} is now: ${items.map((i) => i.text).join("; ") || "empty"}`);
      },
    }),

    add_journal_note: tool({
      description: "Append a note to a day's journal, optionally setting the mood (1–5).",
      inputSchema: z.object({
        text: z.string().max(4000).default(""),
        date: dateInput,
        mood: z.number().int().min(1).max(5).optional(),
      }),
      execute: async ({ text, date, mood }) => {
        const result = await appendJournalNote(text, date, mood);
        if (!result.ok) return failed(result.error);
        return changed(
          ctx,
          `Journal for ${date} updated${text ? " with the note" : ""}${mood ? `, mood ${moodLabel(mood)}` : ""}.`,
        );
      },
    }),
  }),
};
