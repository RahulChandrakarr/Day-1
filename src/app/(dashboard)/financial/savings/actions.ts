"use server";

import { isValidDate } from "@/lib/finance";
import { ACCOUNT_KINDS } from "@/lib/investments";
import {
  authedClient,
  formFields,
  parseAmount,
  refresh,
  uuid,
  type FormState,
} from "../action-utils";

export async function addAccount(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, ["name", "kind", "opening"]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const name = values.name.replace(/\s+/g, " ");
  if (!name || name.length > 60) return fail("Name must be 1–60 characters.");
  if (!ACCOUNT_KINDS.some((k) => k.kind === values.kind))
    return fail("Choose a type.");
  const opening = values.opening ? parseAmount(values.opening) : null;
  if (values.opening && opening === null)
    return fail("Enter a valid starting amount.");

  const supabase = await authedClient();
  const { count } = await supabase
    .from("finance_accounts")
    .select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("finance_accounts")
    .insert({ name, kind: values.kind, color: ((count ?? 0) % 8) + 1 })
    .select("id")
    .single();
  if (error) {
    return fail(
      error.code === "23505"
        ? "You already have an account with that name."
        : error.message,
    );
  }

  // Money already in the account, so totals start from the right place
  if (opening) {
    await supabase.from("finance_investment_entries").insert({
      account_id: data.id,
      kind: "deposit",
      amount: opening,
      note: "Starting balance",
    });
  }

  refresh();
  return {
    error: null,
    ok: true,
    version: prev.version + 1,
    values: { id: data.id },
  };
}

export async function deleteAccount(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_accounts").delete().eq("id", id);
  refresh();
}

export async function addInvestmentEntry(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, [
    "account_id",
    "kind",
    "amount",
    "occurred_on",
    "note",
  ]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  if (!uuid.test(values.account_id)) return fail("Choose an account.");
  if (!["deposit", "withdrawal", "value"].includes(values.kind))
    return fail("Choose what happened.");
  const amount = parseAmount(values.amount, {
    allowZero: values.kind === "value",
  });
  if (amount === null) return fail("Enter a valid amount.");
  if (!isValidDate(values.occurred_on)) return fail("Pick a valid date.");
  if (values.note.length > 200)
    return fail("Keep the note under 200 characters.");

  const supabase = await authedClient();
  const { error } = await supabase.from("finance_investment_entries").insert({
    account_id: values.account_id,
    kind: values.kind,
    amount,
    occurred_on: values.occurred_on,
    note: values.note || null,
  });
  if (error) return fail(error.message);

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteInvestmentEntry(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_investment_entries").delete().eq("id", id);
  refresh();
}
