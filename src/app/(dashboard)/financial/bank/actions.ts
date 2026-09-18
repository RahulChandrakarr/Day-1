"use server";

import { isValidDate, todayISO } from "@/lib/finance";
import {
  authedClient,
  formFields,
  parseAmount,
  refresh,
  uuid,
  type FormState,
} from "../action-utils";

const duplicate = (error: { code?: string }, name: string) =>
  error.code === "23505" ? `You already have an account called ${name}.` : null;

// Adds an account, or renames one and sets what's in it right now
export async function saveBankAccount(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, ["id", "name", "balance"]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const name = values.name.replace(/\s+/g, " ");
  if (!name || name.length > 40) return fail("Name must be 1–40 characters.");
  const raw = values.balance.replace(/,/g, "");
  const balance = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(balance) || Math.abs(balance) >= 1e12)
    return fail("Enter the amount in the account, e.g. 2500.");
  const target = Math.round(balance * 100) / 100;

  const supabase = await authedClient();
  if (values.id) {
    if (!uuid.test(values.id)) return fail("Invalid account.");
    // Keep the logged history: move the starting balance so today's matches
    const { data, error: readError } = await supabase.rpc("bank_balances", {
      p_as_of: todayISO(),
    });
    if (readError) return fail(readError.message);
    const current = (data as { id: string; balance: number | string; opening_balance: number | string }[] | null)
      ?.find((a) => a.id === values.id);
    if (!current) return fail("That account no longer exists.");
    const moved = Number(current.balance) - Number(current.opening_balance);
    const { error } = await supabase
      .from("bank_accounts")
      .update({ name, opening_balance: Math.round((target - moved) * 100) / 100 })
      .eq("id", values.id);
    if (error) return fail(duplicate(error, name) ?? error.message);
  } else {
    const { count } = await supabase
      .from("bank_accounts")
      .select("id", { count: "exact", head: true });
    const { error } = await supabase.from("bank_accounts").insert({
      name,
      opening_balance: target,
      color: ((count ?? 0) % 8) + 1,
    });
    if (error) return fail(duplicate(error, name) ?? error.message);
  }

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

// Entries logged against it stay, just no longer tied to an account
export async function deleteBankAccount(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("bank_accounts").delete().eq("id", id);
  refresh();
}

export async function addTransfer(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, ["from", "to", "amount", "occurred_on", "note"]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  if (!uuid.test(values.from) || !uuid.test(values.to))
    return fail("Pick both accounts.");
  if (values.from === values.to) return fail("Pick two different accounts.");
  const amount = parseAmount(values.amount);
  if (amount === null) return fail("Enter an amount greater than 0.");
  if (!isValidDate(values.occurred_on)) return fail("Pick a valid date.");
  if (values.note.length > 120) return fail("Keep the note under 120 characters.");

  const supabase = await authedClient();
  const { error } = await supabase.from("bank_transfers").insert({
    from_account_id: values.from,
    to_account_id: values.to,
    amount,
    occurred_on: values.occurred_on,
    note: values.note || null,
  });
  if (error) return fail(error.message);

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteTransfer(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("bank_transfers").delete().eq("id", id);
  refresh();
}
