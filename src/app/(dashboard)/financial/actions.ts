"use server";

import { isValidDate } from "@/lib/finance";
import { refreshSpendPin } from "@/lib/push/today";
import {
  authedClient,
  parseAmount,
  refresh,
  uuid,
  type FormState,
} from "./action-utils";

export type { FormState } from "./action-utils";

export async function addTransaction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = Object.fromEntries(
    [
      "type",
      "amount",
      "description",
      "category_id",
      "period",
      "occurred_on",
    ].map((key) => [key, String(formData.get(key) ?? "").trim()]),
  );
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const amount = Number(values.amount.replace(/,/g, ""));
  if (values.type !== "income" && values.type !== "expense")
    return fail("Choose income or expense.");
  if (!Number.isFinite(amount) || amount <= 0)
    return fail("Enter an amount greater than 0.");
  if (amount >= 1e10) return fail("That amount is too large.");
  if (!["daily", "monthly", "yearly"].includes(values.period))
    return fail("Invalid entry type.");
  if (!isValidDate(values.occurred_on)) return fail("Pick a valid date.");
  if (values.description.length > 200)
    return fail("Keep the description under 200 characters.");
  if (values.category_id && !uuid.test(values.category_id))
    return fail("Invalid category.");

  const supabase = await authedClient();
  const { error } = await supabase.from("finance_transactions").insert({
    type: values.type,
    amount: Math.round(amount * 100) / 100,
    description: values.description || null,
    category_id: values.category_id || null,
    period: values.period,
    occurred_on: values.occurred_on,
  });
  if (error) return fail(error.message);

  refresh();
  await refreshSpendPin();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteTransaction(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_transactions").delete().eq("id", id);
  refresh();
  await refreshSpendPin();
}

export async function addCategory(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const color = Number(formData.get("color"));
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values: { name, type, color: String(color) },
  });

  if (!name || name.length > 40) return fail("Name must be 1–40 characters.");
  if (type !== "income" && type !== "expense")
    return fail("Choose income or expense.");
  if (!Number.isInteger(color) || color < 1 || color > 8)
    return fail("Pick a color.");

  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("finance_categories")
    .insert({ name, type, color })
    .select("id")
    .single();
  if (error) {
    return fail(
      error.code === "23505"
        ? "You already have a category with that name."
        : error.message,
    );
  }

  refresh();
  // The new id lets callers select the category straight away
  return {
    error: null,
    ok: true,
    version: prev.version + 1,
    values: { id: data.id },
  };
}

export async function deleteCategory(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_categories").delete().eq("id", id);
  refresh();
}

type LineInput = {
  kind: "spend" | "repay" | "collect";
  category_id: string | null;
  person_id: string | null;
  amount: number;
  note: string | null;
};

export async function saveBudget(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = Object.fromEntries(
    ["scope", "period_key", "expected_income", "savings_target", "lines"].map(
      (key) => [key, String(formData.get(key) ?? "").trim()],
    ),
  );
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const { scope, period_key } = values;
  if (scope === "month") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period_key))
      return fail("Invalid month.");
  } else if (scope === "year") {
    if (!/^\d{4}$/.test(period_key)) return fail("Invalid year.");
  } else {
    return fail("Invalid plan type.");
  }

  const optionalMoney = (raw: string, label: string) => {
    if (!raw) return null;
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) throw new Error(`${label} can't be negative.`);
    if (n >= 1e10) throw new Error(`${label} is too large.`);
    return Math.round(n * 100) / 100;
  };

  let expectedIncome: number | null;
  let savingsTarget: number | null;
  try {
    expectedIncome = optionalMoney(values.expected_income, "Expected income");
    savingsTarget = optionalMoney(values.savings_target, "Savings target");
  } catch (e) {
    return fail((e as Error).message);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(values.lines || "[]");
  } catch {
    return fail("Couldn't read the plan lines.");
  }
  if (!Array.isArray(parsed) || parsed.length > 50)
    return fail("A plan can have up to 50 lines.");

  // Each line is either planned spending in an expense category (existing id,
  // or a new category name) or money to return to / collect from a person.
  // Categories and people may repeat across lines.
  const entries: {
    kind: LineInput["kind"];
    category_id: string | null;
    category_name: string | null;
    person_id: string | null;
    label: string | null;
    amount: number;
  }[] = [];
  for (const raw of parsed as Record<string, unknown>[]) {
    const kindText = String(raw?.kind ?? "spend");
    const category_id = String(raw?.category_id ?? "").trim();
    const category_name = String(raw?.category_name ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const person_id = String(raw?.person_id ?? "").trim();
    const label = String(raw?.label ?? "").trim();
    const amountText = String(raw?.amount ?? "").replace(/,/g, "").trim();
    if (!category_id && !category_name && !person_id && !label && !amountText)
      continue; // blank row
    const what = label ? `"${label}"` : "every line";
    if (kindText !== "spend" && kindText !== "repay" && kindText !== "collect")
      return fail("Invalid line type.");
    const kind = kindText;
    if (kind === "spend") {
      if (!category_id && !category_name)
        return fail(`Pick a category or person for ${what}.`);
      if (category_id && !uuid.test(category_id))
        return fail("Invalid category.");
      if (category_name.length > 40)
        return fail("Keep category names under 40 characters.");
    } else if (!uuid.test(person_id)) {
      return fail("Invalid person.");
    }
    if (label.length > 80) return fail("Keep line names under 80 characters.");
    const amount = parseAmount(amountText);
    if (amount === null || amount >= 1e10)
      return fail(`Enter an amount greater than 0 for ${what}.`);
    entries.push({
      kind,
      category_id: kind === "spend" && category_id ? category_id : null,
      category_name: kind === "spend" && !category_id ? category_name : null,
      person_id: kind === "spend" ? null : person_id,
      label: label || null,
      amount,
    });
  }

  const supabase = await authedClient();

  const lines: LineInput[] = [];
  const spend = entries.filter((e) => e.kind === "spend");
  const byName = new Map<string, string>();
  const categoryIds = new Set<string>();
  if (spend.length > 0) {
    const { data: existing, error } = await supabase
      .from("finance_categories")
      .select("id, name")
      .eq("type", "expense");
    if (error) return fail(error.message);
    for (const c of existing ?? []) {
      categoryIds.add(c.id);
      byName.set(c.name.toLowerCase(), c.id);
    }

    // New category names that don't exist yet are created once each
    const missing = [
      ...new Map(
        spend
          .filter(
            (e) =>
              e.category_name && !byName.has(e.category_name.toLowerCase()),
          )
          .map((e) => [e.category_name!.toLowerCase(), e.category_name!]),
      ).values(),
    ];
    if (missing.length > 0) {
      const { data: created, error: createError } = await supabase
        .from("finance_categories")
        .insert(
          missing.map((name, i) => ({
            name,
            type: "expense",
            color: ((byName.size + i) % 8) + 1,
          })),
        )
        .select("id, name");
      if (createError) return fail(createError.message);
      for (const c of created ?? []) {
        categoryIds.add(c.id);
        byName.set(c.name.toLowerCase(), c.id);
      }
    }
  }

  const personIds = new Set<string>();
  if (entries.some((e) => e.kind !== "spend")) {
    const { data: people, error } = await supabase
      .from("finance_people")
      .select("id");
    if (error) return fail(error.message);
    for (const p of people ?? []) personIds.add(p.id);
  }

  for (const e of entries) {
    if (e.kind === "spend") {
      const category_id = e.category_id
        ? categoryIds.has(e.category_id)
          ? e.category_id
          : undefined
        : byName.get(e.category_name!.toLowerCase());
      if (!category_id)
        return fail("Plan lines must use your expense categories.");
      lines.push({ kind: "spend", category_id, person_id: null, amount: e.amount, note: e.label });
    } else {
      if (!personIds.has(e.person_id!))
        return fail("That person isn't in your Borrow list any more.");
      lines.push({ kind: e.kind, category_id: null, person_id: e.person_id, amount: e.amount, note: e.label });
    }
  }

  const { error } = await supabase.rpc("save_finance_budget", {
    p_scope: scope,
    p_period_key: period_key,
    p_expected_income: expectedIncome,
    p_savings_target: savingsTarget,
    p_lines: lines,
  });
  if (error) return fail(error.message);

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteBudget(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_budgets").delete().eq("id", id);
  refresh();
}
