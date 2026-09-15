import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  addDays,
  addMonths,
  categoryBreakdown,
  isValidDate,
  monthRange,
  todayISO,
  totalsOf,
  type Transaction,
} from "@/lib/finance";
import { getCategories, getTransactions } from "@/lib/finance-queries";
import type { Supabase } from "../types";

const date = z
  .string()
  .refine(isValidDate, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD");

// Compact row shape for the model: no ids, no timestamps.
function row(t: Transaction) {
  return {
    date: t.occurred_on,
    type: t.type,
    amount: t.amount,
    description: t.description,
    category: t.category?.name ?? null,
    period: t.period,
  };
}

function overview(rows: Transaction[]) {
  const totals = totalsOf(rows);
  return {
    ...totals,
    entries: rows.length,
    savingsRatePct:
      totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null,
    expenseByCategory: categoryBreakdown(rows, "expense").map((c) => ({
      category: c.name,
      amount: c.amount,
    })),
    incomeByCategory: categoryBreakdown(rows, "income").map((c) => ({
      category: c.name,
      amount: c.amount,
    })),
    topExpenses: rows
      .filter((t) => t.type === "expense")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(row),
  };
}

export function financeTools() {
  return {
    get_finance_overview: tool({
      description:
        "Income, expenses, net, savings rate, per-category totals and the 5 biggest expenses for a date range. Use one call per range to compare periods.",
      inputSchema: z.object({ from: date, to: date }),
      execute: async ({ from, to }) =>
        overview(await getTransactions({ from, to })),
    }),

    list_transactions: tool({
      description:
        "Individual income/expense entries in a date range, newest first. Optional filters: type, category name, text search in description.",
      inputSchema: z.object({
        from: date,
        to: date,
        type: z.enum(["income", "expense"]).optional(),
        category: z.string().max(40).optional(),
        search: z.string().max(60).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ from, to, type, category, search, limit }) => {
        const rows = (await getTransactions({ from, to })).filter(
          (t) =>
            (!type || t.type === type) &&
            (!category ||
              t.category?.name.toLowerCase() === category.toLowerCase()) &&
            (!search ||
              t.description?.toLowerCase().includes(search.toLowerCase())),
        );
        return {
          matched: rows.length,
          entries: rows.slice(0, limit).map(row),
        };
      },
    }),

    list_categories: tool({
      description: "The user's income and expense categories.",
      inputSchema: z.object({}),
      execute: async () =>
        (await getCategories()).map((c) => ({ name: c.name, type: c.type })),
    }),
  };
}

// Always-available baseline so simple questions need no tool calls.
export async function financeSnapshot(supabase: Supabase) {
  const today = todayISO();
  const month = today.slice(0, 7);
  const lastMonth = addMonths(month, -1);
  const lastMonthRange = monthRange(lastMonth);
  // Same day-of-month last month, for a fair month-to-date comparison
  const lastMonthSameDay = [
    lastMonthRange.to,
    `${lastMonth}-${today.slice(8)}`,
  ].sort()[0];

  const [thisMonthRows, lastMonthRows, recent] = await Promise.all([
    getTransactions({ from: `${month}-01`, to: today }),
    getTransactions({ from: lastMonthRange.from, to: lastMonthRange.to }),
    supabase
      .from("finance_transactions")
      .select(
        "occurred_on, type, amount, description, period, category:finance_categories(name)",
      )
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    thisMonthToDate: {
      range: { from: `${month}-01`, to: today },
      ...overview(thisMonthRows),
    },
    lastMonthFull: { range: lastMonthRange, ...totalsOf(lastMonthRows) },
    lastMonthToSameDay: {
      range: { from: lastMonthRange.from, to: lastMonthSameDay },
      ...totalsOf(
        lastMonthRows.filter((t) => t.occurred_on <= lastMonthSameDay),
      ),
    },
    last10Entries: (recent.data ?? []).map((t) => {
      const cat = t.category as { name: string } | { name: string }[] | null;
      return {
        date: t.occurred_on,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        category: Array.isArray(cat) ? cat[0]?.name : cat?.name,
      };
    }),
  };
}

// Fixed context for the daily briefing (no data agent needed).
export async function financeBriefingContext(supabase: Supabase) {
  const today = todayISO();
  const [snapshot, last7] = await Promise.all([
    financeSnapshot(supabase),
    getTransactions({ from: addDays(today, -6), to: today }),
  ]);
  const prev7 = await getTransactions({
    from: addDays(today, -13),
    to: addDays(today, -7),
  });
  return {
    ...snapshot,
    last7Days: {
      range: { from: addDays(today, -6), to: today },
      ...overview(last7),
    },
    previous7Days: {
      range: { from: addDays(today, -13), to: addDays(today, -7) },
      ...totalsOf(prev7),
    },
  };
}
