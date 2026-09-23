import "server-only";
import { tool } from "ai";
import { z } from "zod";
import {
  addDays,
  addMonths,
  budgetReport,
  categoryBreakdown,
  isValidDate,
  monthRange,
  todayISO,
  totalsOf,
  type BudgetActivity,
  type Transaction,
} from "@/lib/finance";
import { personBalances } from "@/lib/debts";
import { emiSummaries } from "@/lib/emis";
import {
  getAccounts,
  getBankAccounts,
  getBudget,
  getCategories,
  getDebts,
  getEmiPayments,
  getEmis,
  getInvestmentEntries,
  getPeople,
  getTransactions,
} from "@/lib/finance-queries";
import { accountSummaries, netSaved } from "@/lib/investments";
import { addTransaction, deleteTransaction } from "@/app/(dashboard)/financial/actions";
import { addDebt } from "@/app/(dashboard)/financial/borrow/actions";
import { addEmiPayment } from "@/app/(dashboard)/financial/emi/actions";
import { addInvestmentEntry } from "@/app/(dashboard)/financial/savings/actions";
import { DEBT_KINDS } from "@/lib/debts";
import { accountKindLabel } from "@/lib/investments";
import type { Supabase } from "../types";
import {
  changed,
  confirmedInput,
  failed,
  idInput,
  formData,
  INITIAL_FORM,
  monthInput,
  NEEDS_CONFIRMATION,
  pick,
  type Domain,
  type ToolContext,
} from "./common";

const date = z
  .string()
  .refine(isValidDate, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD");

// Compact row shape for the model: no ids, no timestamps.
function row(t: Transaction) {
  return {
    id: t.id,
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

// The user's estimate for the month against what has been logged so far.
function planVsActual(
  budget: Parameters<typeof budgetReport>[0],
  month: string,
  activity: BudgetActivity,
) {
  const report = budgetReport(budget, "month", month, activity);
  return {
    month,
    plannedSpend: report.planned,
    actualSpend: report.actual,
    expectedIncome: report.income.expected,
    actualIncome: report.income.actual,
    savingsTarget: report.savings.target,
    savedIntoInvestments: report.savings.actual,
    daysLeft: report.progress?.daysLeft ?? null,
    projectedMonthSpend: report.progress
      ? Math.round(report.progress.projected)
      : null,
    categories: report.rows.map((r) => ({
      category: r.name,
      planned: r.planned,
      actual: r.actual,
      lines: r.items,
    })),
    unplannedSpending: report.unplanned.map((r) => ({
      category: r.name,
      actual: r.actual,
    })),
    toReturn: report.repay.map((r) => ({
      person: r.name,
      planned: r.planned,
      returnedThisMonth: r.actual,
    })),
    toCollect: report.collect.map((r) => ({
      person: r.name,
      planned: r.planned,
      receivedThisMonth: r.actual,
    })),
  };
}

function financeReadTools() {
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

function financeWriteTools(ctx: ToolContext) {
  return {
    get_budget: tool({
      description:
        "The user's own spending plan for a month (YYYY-MM) or year (YYYY) compared with what actually happened: planned vs spent per category, income, savings target, money to return/collect.",
      inputSchema: z.object({
        month: monthInput.optional(),
        year: z.number().int().min(2000).max(2200).optional(),
      }),
      execute: async ({ month, year }) => {
        const scope = month ? "month" : "year";
        const key = month ?? String(year ?? Number(ctx.today.slice(0, 4)));
        const { from, to } = month ? monthRange(month) : { from: `${key}-01-01`, to: `${key}-12-31` };
        const [budget, transactions, debts, investments] = await Promise.all([
          getBudget(scope, key),
          getTransactions({ from, to }),
          getDebts({ from, to }),
          getInvestmentEntries({ from, to }),
        ]);
        if (!budget) return { period: key, plan: null, note: "No plan made for this period." };
        const report = budgetReport(budget, scope, key, { transactions, debts, investments }, ctx.today);
        return {
          period: key,
          planned: report.planned,
          spent: report.actual,
          income: report.income,
          savings: report.savings,
          progress: report.progress,
          categories: [...report.rows, ...report.unplanned].map((r) => ({
            category: r.name,
            planned: r.planned,
            spent: r.actual,
            left: r.planned - r.actual,
          })),
          toReturn: report.repay.map((r) => ({ person: r.name, planned: r.planned, done: r.actual })),
          toCollect: report.collect.map((r) => ({ person: r.name, planned: r.planned, done: r.actual })),
        };
      },
    }),

    get_borrow: tool({
      description: "Money the user owes people and money people owe the user, per person, with recent entries.",
      inputSchema: z.object({}),
      execute: async () => {
        const [people, debts] = await Promise.all([getPeople(), getDebts()]);
        return personBalances(people, debts).map((p) => ({
          person: p.name,
          userOwes: p.owe,
          owesUser: p.owed,
          lastEntry: p.lastOn,
          recent: p.entries.slice(0, 5).map((e) => ({
            date: e.occurred_on,
            kind: e.kind,
            amount: e.amount,
            note: e.note,
          })),
        }));
      },
    }),

    get_savings: tool({
      description: "Savings & investment accounts: money put in, current worth, gain, SIP details and recent entries.",
      inputSchema: z.object({}),
      execute: async () => {
        const [accounts, entries] = await Promise.all([getAccounts(), getInvestmentEntries()]);
        return accountSummaries(accounts, entries).map((a) => ({
          account: a.name,
          type: accountKindLabel(a.kind),
          putIn: a.invested,
          worthNow: a.current,
          gain: a.gain,
          valueUpdatedOn: a.valuedOn,
          sip: a.sip_amount ? { amount: a.sip_amount, day: a.sip_day } : null,
          recent: a.entries.slice(0, 5).map((e) => ({ date: e.occurred_on, kind: e.kind, amount: e.amount })),
        }));
      },
    }),

    get_emis: tool({
      description:
        "Loans and EMIs: monthly payment, how much is paid, how much is left, next due date, and recent installments.",
      inputSchema: z.object({}),
      execute: async () => {
        const [emis, payments] = await Promise.all([getEmis(), getEmiPayments()]);
        return emiSummaries(emis, payments, ctx.today).map((e) => ({
          name: e.name,
          lender: e.lender,
          monthly: e.monthly_amount,
          total: e.total_amount,
          paid: e.paid,
          remaining: e.remaining,
          monthsDone: e.monthsDone,
          monthsLeft: e.monthsLeft,
          tenure: e.tenure,
          dueDay: e.due_day,
          nextDueOn: e.nextDueOn,
          paidThisMonth: e.paidThisMonth,
          overdue: e.overdue,
          recent: e.payments.slice(0, 5).map((p) => ({
            date: p.occurred_on,
            amount: p.amount,
            note: p.note,
          })),
        }));
      },
    }),

    add_transaction: tool({
      description: "Log money spent (expense) or received (income).",
      inputSchema: z.object({
        type: z.enum(["expense", "income"]),
        amount: z.number().positive(),
        category: z.string().max(40).optional().describe("Existing category name; omit if unsure"),
        date: date,
        description: z.string().max(200).optional(),
        period: z.enum(["daily", "monthly", "yearly"]).default("daily").describe("monthly/yearly for recurring bills"),
        account: z
          .string()
          .max(40)
          .optional()
          .describe("Bank account it came out of or went into, by name; omit to use the one from their last entry"),
      }),
      execute: async ({ type, amount, category, date: on, description, period, account }) => {
        let categoryId: string | null = null;
        let categoryName: string | null = null;
        if (category) {
          const options = (await getCategories()).filter((c) => c.type === type);
          const found = pick(options, category, (c) => c.name);
          if ("error" in found) return failed(`${found.error} Ask which category to use, or log it without one.`);
          categoryId = found.item.id;
          categoryName = found.item.name;
        }
        // Which bank account: the one named, else the one used last time
        const banks = await getBankAccounts(on);
        let bank: { id: string; name: string } | null = null;
        if (account && banks.length) {
          const found = pick(banks, account, (b) => b.name);
          if ("error" in found) return failed(`${found.error} Ask which account, or log it without one.`);
          bank = found.item;
        } else if (banks.length) {
          const { data: last } = await ctx.supabase
            .from("finance_transactions")
            .select("bank_account_id")
            .not("bank_account_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          bank = banks.find((b) => b.id === last?.bank_account_id) ?? (banks.length === 1 ? banks[0] : null);
        }
        const result = await addTransaction(
          INITIAL_FORM,
          formData({
            type,
            amount,
            category_id: categoryId,
            occurred_on: on,
            description,
            period,
            bank_account_id: bank?.id ?? null,
          }),
        );
        if (!result.ok) return failed(result.error ?? "Couldn't save.");
        return changed(
          ctx,
          `Logged ${type} of ₹${amount}${categoryName ? ` in ${categoryName}` : ""} on ${on}${description ? ` (${description})` : ""}${
            bank ? ` ${type === "expense" ? "from" : "into"} ${bank.name}` : banks.length ? " (no bank account)" : ""
          }.`,
        );
      },
    }),

    add_debt: tool({
      description:
        "Log borrowing: borrowed (user took money), repaid (user paid back), lent (user gave money), received (user got money back).",
      inputSchema: z.object({
        kind: z.enum(DEBT_KINDS.map((k) => k.kind) as ["borrowed", "repaid", "lent", "received"]),
        person: z.string().min(1).max(60),
        amount: z.number().positive(),
        date: date,
        note: z.string().max(200).optional(),
        countInBalance: z.boolean().default(false).describe("Also count it in the day's income/spending balance"),
      }),
      execute: async ({ kind, person, amount, date: on, note, countInBalance }) => {
        const result = await addDebt(
          INITIAL_FORM,
          formData({ kind, person, amount, occurred_on: on, note, in_balance: countInBalance ? "yes" : "no" }),
        );
        if (!result.ok) return failed(result.error ?? "Couldn't save.");
        return changed(ctx, `Logged: ${kind} ₹${amount} with ${person} on ${on}.`);
      },
    }),

    add_investment_entry: tool({
      description: "Log money put into or taken out of a savings/investment account, or update its current value.",
      inputSchema: z.object({
        account: z.string().min(1),
        kind: z.enum(["deposit", "withdrawal", "value"]),
        amount: z.number().min(0),
        date: date,
        note: z.string().max(200).optional(),
      }),
      execute: async ({ account, kind, amount, date: on, note }) => {
        const found = pick(await getAccounts(), account, (a) => a.name);
        if ("error" in found) return failed(found.error);
        const result = await addInvestmentEntry(
          INITIAL_FORM,
          formData({ account_id: found.item.id, kind, amount, occurred_on: on, note }),
        );
        if (!result.ok) return failed(result.error ?? "Couldn't save.");
        return changed(ctx, `${found.item.name}: ${kind} ₹${amount} on ${on}.`);
      },
    }),

    add_emi_payment: tool({
      description: "Log an EMI installment against a named loan.",
      inputSchema: z.object({
        emi: z.string().min(1).describe("EMI name, e.g. Home loan"),
        amount: z.number().positive(),
        date: date,
        note: z.string().max(200).optional(),
      }),
      execute: async ({ emi, amount, date: on, note }) => {
        const found = pick(await getEmis(), emi, (e) => e.name);
        if ("error" in found) return failed(found.error);
        const result = await addEmiPayment(
          INITIAL_FORM,
          formData({ emi_id: found.item.id, amount, occurred_on: on, note }),
        );
        if (!result.ok) return failed(result.error ?? "Couldn't save.");
        return changed(ctx, `${found.item.name}: paid ₹${amount} on ${on}.`);
      },
    }),

    delete_transaction: tool({
      description: "Delete a money entry by id (from list_transactions). Confirm with the user first.",
      inputSchema: z.object({ id: idInput, describe: z.string().optional(), confirmed: confirmedInput }),
      execute: async ({ id, describe, confirmed }) => {
        if (!confirmed) return { ...NEEDS_CONFIRMATION, wouldDelete: describe ?? id };
        await deleteTransaction(id);
        return changed(ctx, `Deleted the entry${describe ? ` (${describe})` : ""}.`);
      },
    }),
  };
}

export const finance: Domain = {
  labels: {
    get_finance_overview: "Adding up your money…",
    list_transactions: "Checking your transactions…",
    list_categories: "Looking at your categories…",
    get_budget: "Comparing with your plan…",
    get_borrow: "Checking who owes what…",
    get_savings: "Checking your savings…",
    get_emis: "Checking your EMIs…",
    add_transaction: "Logging the entry…",
    add_debt: "Logging the borrow entry…",
    add_investment_entry: "Updating your savings…",
    add_emi_payment: "Logging the EMI payment…",
    delete_transaction: "Removing the entry…",
  },
  prompt: `FINANCE
- Money is Indian Rupees; show it like ₹1,23,456. The <today> block has today's and this month's money, net balance and each bank account. A <finance> block, when present, adds last month, the plan, borrow balances and savings. Otherwise call a tool only for what the question needs.
- When logging, pass the bank account they name; if they don't say, the tool uses the account from their last entry. Mention the account in your one-line confirmation.
- For comparisons fetch each period separately with exact date ranges, and check the direction (bigger = up). Compare month-to-date with the same days of last month.
- Borrowed/lent money is NOT income or spending unless the entry counts in the balance. Savings & investments are accounts with deposits, withdrawals and value updates. EMIs are loans: monthly payment, paid so far, remaining, next due. EMI payments are not daily spend unless also logged as an expense.
- When logging an expense, pick an existing category (list_categories) that clearly fits; if none fits, log it without a category and say so.`,
  tools: (ctx) => ({ ...financeReadTools(), ...financeWriteTools(ctx) }),
};

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

  const [
    thisMonthRows,
    lastMonthRows,
    recent,
    monthPlan,
    people,
    debts,
    accounts,
    investments,
    emis,
    emiPayments,
  ] = await Promise.all([
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
    getBudget("month", month),
    getPeople(),
    getDebts(),
    getAccounts(),
    getInvestmentEntries(),
    getEmis(),
    getEmiPayments(),
  ]);
  const monthDebts = debts.filter((d) => d.occurred_on.startsWith(month));
  const monthInvestments = investments.filter((e) =>
    e.occurred_on.startsWith(month),
  );
  const balances = personBalances(people, debts).filter(
    (p) => p.owe > 0 || p.owed > 0,
  );
  const holdings = accountSummaries(accounts, investments);
  const emiList = emiSummaries(emis, emiPayments, today);

  return {
    thisMonthToDate: {
      range: { from: `${month}-01`, to: today },
      ...overview(thisMonthRows),
    },
    thisMonthPlan: monthPlan
      ? planVsActual(monthPlan, month, {
          transactions: thisMonthRows,
          debts: monthDebts,
          investments: monthInvestments,
        })
      : null,
    // Borrow/lend balances (not income or expenses)
    borrowBalances: balances.map((p) => ({
      person: p.name,
      userOwes: p.owe,
      owesUser: p.owed,
      lastEntry: p.lastOn,
    })),
    savingsAndInvestments: {
      totalPutIn: holdings.reduce((s, a) => s + a.invested, 0),
      totalWorthNow: holdings.reduce((s, a) => s + a.current, 0),
      savedThisMonth: netSaved(monthInvestments),
      accounts: holdings.map((a) => ({
        name: a.name,
        type: a.kind,
        putIn: a.invested,
        worthNow: a.current,
        valueUpdatedOn: a.valuedOn,
      })),
    },
    emis: emiList.map((e) => ({
      name: e.name,
      lender: e.lender,
      monthly: e.monthly_amount,
      paid: e.paid,
      remaining: e.remaining,
      monthsDone: e.monthsDone,
      monthsLeft: e.monthsLeft,
      nextDueOn: e.nextDueOn,
      paidThisMonth: e.paidThisMonth,
      overdue: e.overdue,
    })),
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
