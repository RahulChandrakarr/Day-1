"use server";

import { revalidatePath } from "next/cache";
import { isValidDate } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error: string | null;
  // Bumps on every submit so the client can react (reset, toast)
  version: number;
  ok: boolean;
  values?: Record<string, string>;
};

const uuid = /^[0-9a-f-]{36}$/i;

async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new Error("Not signed in.");
  return supabase;
}

function refresh() {
  revalidatePath("/financial", "layout");
}

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
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteTransaction(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_transactions").delete().eq("id", id);
  refresh();
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
  const { error } = await supabase
    .from("finance_categories")
    .insert({ name, type, color });
  if (error) {
    return fail(
      error.code === "23505"
        ? "You already have a category with that name."
        : error.message,
    );
  }

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteCategory(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_categories").delete().eq("id", id);
  refresh();
}
