"use server";

import { isValidDate, todayISO } from "@/lib/finance";
import { syncPortfolio } from "@/lib/groww-sync";
import { NO_MARKET_DATA } from "@/lib/groww";
import { ACCOUNT_KINDS, isRecurringKind, type AccountKind } from "@/lib/investments";
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
  const values = formFields(formData, [
    "name",
    "kind",
    "opening",
    "sip_day",
    "sip_amount",
  ]);
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

  // SIP / recurring deposit: monthly amount and deduction day
  const recurring = isRecurringKind(values.kind as AccountKind);
  const sipDay = recurring && values.sip_day ? Number(values.sip_day) : null;
  if (sipDay !== null && (!Number.isInteger(sipDay) || sipDay < 1 || sipDay > 31))
    return fail("Pick a deduction date between 1 and 31.");
  const sipAmount =
    recurring && values.sip_amount ? parseAmount(values.sip_amount) : null;
  if (recurring && values.sip_amount && sipAmount === null)
    return fail("Enter a valid monthly amount.");

  const supabase = await authedClient();
  const { count } = await supabase
    .from("finance_accounts")
    .select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("finance_accounts")
    .insert({
      name,
      kind: values.kind,
      color: ((count ?? 0) % 8) + 1,
      sip_day: sipDay,
      sip_amount: sipAmount,
    })
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

// Fetches the Groww holdings again. Returns a message either way so the
// button can say what happened.
export async function refreshPortfolio(): Promise<{ ok: boolean; message: string }> {
  await authedClient();
  const result = await syncPortfolio();
  if (!result.ok) return { ok: false, message: result.error };
  refresh();
  const count = result.holdings ?? 0;
  if (count === 0) return { ok: true, message: "No stocks in your demat account." };
  const stocks = `${count} ${count === 1 ? "stock" : "stocks"}`;
  if (result.pricesOk === false)
    return { ok: true, message: `${stocks} updated. ${NO_MARKET_DATA}` };
  const unpriced = result.unpriced ?? 0;
  return {
    ok: true,
    message: unpriced
      ? `${stocks} updated, ${unpriced} without a live price.`
      : `${stocks} updated.`,
  };
}

// How a stock is being held, and the lines the user set for it. The prices are
// their own plan, not a suggestion from anywhere.
export async function saveHoldingPlan(input: {
  id: string;
  mode: "long_term" | "swing";
  bought_on: string | null;
  target_price: string | null;
  stop_price: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!uuid.test(input.id)) return { ok: false, error: "Unknown holding." };
  if (input.mode !== "long_term" && input.mode !== "swing")
    return { ok: false, error: "Pick long term or swing." };
  if (input.bought_on && !isValidDate(input.bought_on))
    return { ok: false, error: "Pick a valid buy date." };
  if (input.bought_on && input.bought_on > todayISO())
    return { ok: false, error: "The buy date can't be in the future." };

  const price = (raw: string | null) => (raw?.trim() ? parseAmount(raw) : null);
  const target = price(input.target_price);
  const stop = price(input.stop_price);
  if (input.target_price?.trim() && target === null)
    return { ok: false, error: "That target price isn't a number." };
  if (input.stop_price?.trim() && stop === null)
    return { ok: false, error: "That stop price isn't a number." };

  const supabase = await authedClient();
  const { error } = await supabase
    .from("finance_holdings")
    .update({
      mode: input.mode,
      bought_on: input.bought_on,
      target_price: target,
      stop_price: stop,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
