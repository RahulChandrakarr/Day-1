// Shared finance types and helpers (safe for server and client).

export const APP_TIMEZONE = "Asia/Kolkata";
export const CURRENCY = "INR";
export const LOCALE = "en-IN";

export type TxType = "income" | "expense";
export type TxPeriod = "daily" | "monthly" | "yearly";

export type Category = {
  id: string;
  name: string;
  type: TxType;
  color: number;
};

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  description: string | null;
  period: TxPeriod;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
  category: Pick<Category, "id" | "name" | "color"> | null;
};

export type Totals = { income: number; expense: number; net: number };

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------
const moneyWhole = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const moneyCents = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(value: number) {
  return Number.isInteger(value)
    ? moneyWhole.format(value)
    : moneyCents.format(value);
}

export function formatCompact(value: number) {
  return compact.format(value);
}

export function totalsOf(rows: Pick<Transaction, "type" | "amount">[]): Totals {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === "income") income += row.amount;
    else expense += row.amount;
  }
  return { income, expense, net: income - expense };
}

// ---------------------------------------------------------------------------
// Dates — plain YYYY-MM-DD strings, no timezone drift
// ---------------------------------------------------------------------------
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoMonth = /^\d{4}-\d{2}$/;

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(
    new Date(),
  );
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d ?? 1));
}

function fromUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    isoDate.test(value) &&
    fromUTC(toUTC(value)) === value
  );
}

export function addDays(iso: string, days: number) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function addMonths(month: string, months: number) {
  const d = toUTC(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return fromUTC(d).slice(0, 7);
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(month: string) {
  return {
    from: `${month}-01`,
    to: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`,
  };
}

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function parseDateParam(value: unknown) {
  return isValidDate(value) ? value : todayISO();
}

export function parseMonthParam(value: unknown) {
  return typeof value === "string" && isoMonth.test(value)
    ? value
    : todayISO().slice(0, 7);
}

export function parseYearParam(value: unknown) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1970 && year <= 2200
    ? year
    : Number(todayISO().slice(0, 4));
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...options });

const fullDate = fmt({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDate = fmt({ weekday: "short", day: "numeric", month: "short" });
const monthYear = fmt({ month: "long", year: "numeric" });
const monthShort = fmt({ month: "short" });

export const formatFullDate = (iso: string) => fullDate.format(toUTC(iso));
export const formatShortDate = (iso: string) => shortDate.format(toUTC(iso));
export const formatMonth = (month: string) =>
  monthYear.format(toUTC(`${month}-01`));
export const formatMonthShort = (month: string) =>
  monthShort.format(toUTC(`${month}-01`));

// ---------------------------------------------------------------------------
// Chart buckets
// ---------------------------------------------------------------------------
export type Bucket = {
  key: string;
  label: string; // axis label
  title: string; // tooltip / table label
  href?: string;
  income: number;
  expense: number;
};

type Row = Pick<Transaction, "type" | "amount" | "occurred_on">;

function fill(buckets: Bucket[], rows: Row[], keyOf: (row: Row) => string) {
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of rows) {
    const bucket = byKey.get(keyOf(row));
    if (!bucket) continue;
    bucket[row.type] += row.amount;
  }
  return buckets;
}

export function dayBuckets(month: string, rows: Row[]) {
  const buckets = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const key = `${month}-${String(i + 1).padStart(2, "0")}`;
    return {
      key,
      label: String(i + 1),
      title: formatShortDate(key),
      href: `/financial/daily?date=${key}`,
      income: 0,
      expense: 0,
    };
  });
  return fill(buckets, rows, (r) => r.occurred_on);
}

export function monthBuckets(year: number, rows: Row[]) {
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return {
      key,
      label: formatMonthShort(key),
      title: formatMonth(key),
      href: `/financial/monthly?month=${key}`,
      income: 0,
      expense: 0,
    };
  });
  return fill(buckets, rows, (r) => r.occurred_on.slice(0, 7));
}

export function yearBuckets(years: number[], rows: Row[]) {
  const buckets = years.map((year) => ({
    key: String(year),
    label: String(year),
    title: String(year),
    href: `/financial/yearly?year=${year}`,
    income: 0,
    expense: 0,
  }));
  return fill(buckets, rows, (r) => r.occurred_on.slice(0, 4));
}

export type CategorySlice = {
  id: string;
  name: string;
  color: number;
  amount: number;
};

export function categoryBreakdown(rows: Transaction[], type: TxType) {
  const map = new Map<string, CategorySlice>();
  for (const row of rows) {
    if (row.type !== type) continue;
    const id = row.category?.id ?? "none";
    const slice = map.get(id) ?? {
      id,
      name: row.category?.name ?? "Uncategorized",
      color: row.category?.color ?? 8,
      amount: 0,
    };
    slice.amount += row.amount;
    map.set(id, slice);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// Budgets — an estimate for a month or year, compared with actual entries
// ---------------------------------------------------------------------------
export type BudgetScope = "month" | "year";

export type BudgetLine = {
  category_id: string;
  name: string;
  color: number;
  amount: number;
  note: string | null;
};

export type Budget = {
  id: string;
  scope: BudgetScope;
  period_key: string; // YYYY-MM or YYYY
  expected_income: number | null;
  savings_target: number | null;
  lines: BudgetLine[];
};

export type BudgetRow = {
  id: string;
  name: string;
  color: number;
  note: string | null;
  planned: number;
  actual: number;
};

export type BudgetReport = {
  rows: BudgetRow[]; // planned categories, in plan order
  unplanned: BudgetRow[]; // spending in categories without a plan line
  planned: number;
  actual: number; // all expenses in the period
  income: { expected: number | null; actual: number };
  savings: { target: number | null; actual: number };
  // Only for the period that contains today
  progress: {
    elapsed: number; // 0..1
    daysLeft: number;
    // Planned lines spent in full (or as already spent, if over), plus
    // unplanned spending continuing at its current pace
    projected: number;
  } | null;
  ended: boolean;
};

export function periodRange(scope: BudgetScope, key: string) {
  return scope === "month" ? monthRange(key) : yearRange(Number(key));
}

export function formatPeriod(scope: BudgetScope, key: string) {
  return scope === "month" ? formatMonth(key) : key;
}

export function previousPeriodKey(scope: BudgetScope, key: string) {
  return scope === "month" ? addMonths(key, -1) : String(Number(key) - 1);
}

export function budgetReport(
  budget: Pick<Budget, "expected_income" | "savings_target" | "lines">,
  scope: BudgetScope,
  key: string,
  transactions: Transaction[],
  today = todayISO(),
): BudgetReport {
  const spent = new Map(
    categoryBreakdown(transactions, "expense").map((s) => [s.id, s]),
  );
  const rows = budget.lines.map((line) => ({
    id: line.category_id,
    name: line.name,
    color: line.color,
    note: line.note,
    planned: line.amount,
    actual: spent.get(line.category_id)?.amount ?? 0,
  }));
  const plannedIds = new Set(rows.map((r) => r.id));
  const unplanned = [...spent.values()]
    .filter((s) => !plannedIds.has(s.id))
    .map((s) => ({ ...s, note: null, planned: 0, actual: s.amount }));

  const totals = totalsOf(transactions);
  const { from, to } = periodRange(scope, key);
  let progress: BudgetReport["progress"] = null;
  if (today >= from && today <= to) {
    const total = dayIndex(to) - dayIndex(from) + 1;
    const done = dayIndex(today) - dayIndex(from) + 1;
    const elapsed = done / total;
    const unplannedSpend = unplanned.reduce((sum, r) => sum + r.actual, 0);
    progress = {
      elapsed,
      daysLeft: total - done,
      projected:
        rows.reduce((sum, r) => sum + Math.max(r.actual, r.planned), 0) +
        unplannedSpend / elapsed,
    };
  }

  return {
    rows,
    unplanned,
    planned: rows.reduce((sum, r) => sum + r.planned, 0),
    actual: totals.expense,
    income: { expected: budget.expected_income, actual: totals.income },
    savings: { target: budget.savings_target, actual: totals.net },
    progress,
    ended: today > to,
  };
}

function dayIndex(iso: string) {
  return toUTC(iso).getTime() / 86_400_000;
}
