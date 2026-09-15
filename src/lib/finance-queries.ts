import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DebtEntry, Person } from "@/lib/debts";
import type { Account, InvestmentEntry } from "@/lib/investments";
import type {
  Budget,
  BudgetLine,
  BudgetScope,
  Category,
  Transaction,
  TxPeriod,
} from "@/lib/finance";

const TX_COLUMNS =
  "id, type, amount, description, period, occurred_on, created_at, category:finance_categories(id, name, color)";

type TxRow = Omit<Transaction, "amount" | "category"> & {
  amount: number | string;
  category: Transaction["category"] | Transaction["category"][];
};

function normalize(rows: TxRow[] | null): Transaction[] {
  return (rows ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount),
    category: Array.isArray(row.category)
      ? (row.category[0] ?? null)
      : row.category,
  }));
}

export async function getTransactions(options: {
  from?: string;
  to?: string;
  period?: TxPeriod;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("finance_transactions")
    .select(TX_COLUMNS)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.from) query = query.gte("occurred_on", options.from);
  if (options.to) query = query.lte("occurred_on", options.to);
  if (options.period) query = query.eq("period", options.period);

  const { data, error } = await query.returns<TxRow[]>();
  if (error) throw new Error(error.message);
  return normalize(data);
}

export async function getCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_categories")
    .select("id, name, type, color")
    .order("created_at", { ascending: true })
    .returns<Category[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// How often each category was used in recent entries, for "most used first".
export async function getCategoryUsage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("category_id")
    .not("category_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const usage: Record<string, number> = {};
  for (const row of data ?? [])
    usage[row.category_id] = (usage[row.category_id] ?? 0) + 1;
  return usage;
}

// Years that have any entries, always including the current one.
export async function getYearsWithData(currentYear: number) {
  const supabase = await createClient();
  const [{ data: first }, { data: last }] = await Promise.all([
    supabase
      .from("finance_transactions")
      .select("occurred_on")
      .order("occurred_on", { ascending: true })
      .limit(1),
    supabase
      .from("finance_transactions")
      .select("occurred_on")
      .order("occurred_on", { ascending: false })
      .limit(1),
  ]);
  const start = Math.min(
    currentYear,
    first?.[0] ? Number(first[0].occurred_on.slice(0, 4)) : currentYear,
  );
  const end = Math.max(
    currentYear,
    last?.[0] ? Number(last[0].occurred_on.slice(0, 4)) : currentYear,
  );
  const from = Math.max(start, end - 9); // at most 10 years on the chart
  return Array.from({ length: end - from + 1 }, (_, i) => from + i);
}

const BUDGET_COLUMNS =
  "id, scope, period_key, expected_income, savings_target, lines:finance_budget_lines(kind, category_id, person_id, position, amount, note, created_at, category:finance_categories(name, color), person:finance_people(name))";

type Joined<T> = T | T[] | null;
const one = <T>(value: Joined<T>) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

type BudgetRowData = Omit<Budget, "expected_income" | "savings_target" | "lines"> & {
  expected_income: number | string | null;
  savings_target: number | string | null;
  lines: {
    kind: BudgetLine["kind"];
    category_id: string | null;
    person_id: string | null;
    position: number;
    amount: number | string;
    note: string | null;
    created_at: string;
    category: Joined<{ name: string; color: number }>;
    person: Joined<{ name: string }>;
  }[];
};

function toBudget(row: BudgetRowData): Budget {
  const money = (v: number | string | null) => (v === null ? null : Number(v));
  return {
    ...row,
    expected_income: money(row.expected_income),
    savings_target: money(row.savings_target),
    lines: [...row.lines]
      .sort(
        (a, b) =>
          a.position - b.position || a.created_at.localeCompare(b.created_at),
      )
      .map((line) => {
        const category = one(line.category);
        const person = one(line.person);
        return {
          kind: line.kind,
          category_id: line.category_id,
          person_id: line.person_id,
          name:
            line.kind === "spend"
              ? (category?.name ?? "Deleted category")
              : (person?.name ?? "Deleted person"),
          color: line.kind === "spend" ? (category?.color ?? 8) : 8,
          amount: Number(line.amount),
          note: line.note,
        };
      }),
  };
}

export async function getBudget(scope: BudgetScope, key: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_budgets")
    .select(BUDGET_COLUMNS)
    .eq("scope", scope)
    .eq("period_key", key)
    .returns<BudgetRowData[]>()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBudget(data) : null;
}

// Most recent plan before this period, used to start a new plan from it.
export async function getPreviousBudget(scope: BudgetScope, key: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_budgets")
    .select(BUDGET_COLUMNS)
    .eq("scope", scope)
    .lt("period_key", key)
    .order("period_key", { ascending: false })
    .limit(1)
    .returns<BudgetRowData[]>();
  if (error) throw new Error(error.message);
  return data?.[0] ? toBudget(data[0]) : null;
}

export async function getMonthBudgets(year: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_budgets")
    .select(BUDGET_COLUMNS)
    .eq("scope", "month")
    .like("period_key", `${year}-%`)
    .returns<BudgetRowData[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBudget);
}

// ---------------------------------------------------------------------------
// Borrow / lend
// ---------------------------------------------------------------------------
export async function getPeople() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_people")
    .select("id, name")
    .order("name")
    .returns<Person[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

type DebtRow = Omit<DebtEntry, "amount" | "person"> & {
  amount: number | string;
  person: Joined<Person>;
};

export async function getDebts(options: { from?: string; to?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("finance_debts")
    .select(
      "id, kind, amount, note, occurred_on, created_at, in_balance, person:finance_people(id, name)",
    )
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (options.from) query = query.gte("occurred_on", options.from);
  if (options.to) query = query.lte("occurred_on", options.to);
  const { data, error } = await query.returns<DebtRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const person = one(row.person);
    return person ? [{ ...row, amount: Number(row.amount), person }] : [];
  });
}

// ---------------------------------------------------------------------------
// Savings & investments
// ---------------------------------------------------------------------------
export async function getAccounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("id, name, kind, color")
    .order("created_at", { ascending: true })
    .returns<Account[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getInvestmentEntries(
  options: { from?: string; to?: string } = {},
) {
  const supabase = await createClient();
  let query = supabase
    .from("finance_investment_entries")
    .select("id, account_id, kind, amount, note, occurred_on, created_at")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (options.from) query = query.gte("occurred_on", options.from);
  if (options.to) query = query.lte("occurred_on", options.to);
  const { data, error } = await query.returns<
    (Omit<InvestmentEntry, "amount"> & { amount: number | string })[]
  >();
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) }));
}
