import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Category, Transaction, TxPeriod } from "@/lib/finance";

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
