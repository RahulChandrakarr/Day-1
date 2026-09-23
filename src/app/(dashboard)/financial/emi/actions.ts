"use server";

import { isValidDate } from "@/lib/finance";
import {
  authedClient,
  formFields,
  parseAmount,
  refresh,
  uuid,
  type FormState,
} from "../action-utils";

export type { FormState } from "../action-utils";

export async function addEmi(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, [
    "name",
    "lender",
    "monthly_amount",
    "tenure_months",
    "total_amount",
    "already_paid",
    "start_on",
    "due_day",
    "note",
  ]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const name = values.name.replace(/\s+/g, " ");
  if (!name || name.length > 60) return fail("Name must be 1–60 characters.");
  const lender = values.lender.replace(/\s+/g, " ");
  if (lender.length > 60) return fail("Keep the lender under 60 characters.");

  const monthly = parseAmount(values.monthly_amount);
  if (monthly === null) return fail("Enter the monthly EMI.");

  const tenureRaw = values.tenure_months;
  const tenure = tenureRaw ? Number(tenureRaw) : null;
  if (
    tenureRaw &&
    (!Number.isInteger(tenure) || tenure === null || tenure < 1 || tenure > 720)
  )
    return fail("Tenure must be 1–720 months.");

  let total = values.total_amount ? parseAmount(values.total_amount) : null;
  if (values.total_amount && total === null)
    return fail("Enter a valid total to repay.");
  if (total === null && tenure) total = Math.round(monthly * tenure * 100) / 100;
  if (total === null) return fail("Enter the total to repay, or the tenure.");

  const already = values.already_paid ? parseAmount(values.already_paid) : 0;
  if (values.already_paid && already === null)
    return fail("Enter a valid amount already paid.");
  if (already !== null && already > total)
    return fail("Already paid can’t be more than the total.");

  if (!isValidDate(values.start_on)) return fail("Pick a valid start date.");
  const dueDay = Number(values.due_day);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
    return fail("Due day must be between 1 and 31.");
  if (values.note.length > 200)
    return fail("Keep the note under 200 characters.");

  const supabase = await authedClient();
  const { count } = await supabase
    .from("finance_emis")
    .select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("finance_emis")
    .insert({
      name,
      lender: lender || null,
      total_amount: total,
      monthly_amount: monthly,
      start_on: values.start_on,
      due_day: dueDay,
      tenure_months: tenure,
      note: values.note || null,
      color: ((count ?? 0) % 8) + 1,
    })
    .select("id")
    .single();
  if (error) {
    return fail(
      error.code === "23505"
        ? "You already have an EMI with that name."
        : error.message,
    );
  }

  if (already) {
    await supabase.from("finance_emi_payments").insert({
      emi_id: data.id,
      amount: already,
      occurred_on: values.start_on,
      note: "Paid before tracking",
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

export async function updateEmi(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, [
    "id",
    "name",
    "lender",
    "monthly_amount",
    "tenure_months",
    "total_amount",
    "start_on",
    "due_day",
    "note",
  ]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  if (!uuid.test(values.id)) return fail("That EMI is missing.");
  const name = values.name.replace(/\s+/g, " ");
  if (!name || name.length > 60) return fail("Name must be 1–60 characters.");
  const lender = values.lender.replace(/\s+/g, " ");
  if (lender.length > 60) return fail("Keep the lender under 60 characters.");

  const monthly = parseAmount(values.monthly_amount);
  if (monthly === null) return fail("Enter the monthly EMI.");

  const tenureRaw = values.tenure_months;
  const tenure = tenureRaw ? Number(tenureRaw) : null;
  if (
    tenureRaw &&
    (!Number.isInteger(tenure) || tenure === null || tenure < 1 || tenure > 720)
  )
    return fail("Tenure must be 1–720 months.");

  let total = values.total_amount ? parseAmount(values.total_amount) : null;
  if (values.total_amount && total === null)
    return fail("Enter a valid total to repay.");
  if (total === null && tenure) total = Math.round(monthly * tenure * 100) / 100;
  if (total === null) return fail("Enter the total to repay, or the tenure.");

  if (!isValidDate(values.start_on)) return fail("Pick a valid start date.");
  const dueDay = Number(values.due_day);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
    return fail("Due day must be between 1 and 31.");
  if (values.note.length > 200)
    return fail("Keep the note under 200 characters.");

  const supabase = await authedClient();
  const { error } = await supabase
    .from("finance_emis")
    .update({
      name,
      lender: lender || null,
      total_amount: total,
      monthly_amount: monthly,
      start_on: values.start_on,
      due_day: dueDay,
      tenure_months: tenure,
      note: values.note || null,
    })
    .eq("id", values.id);
  if (error) {
    return fail(
      error.code === "23505"
        ? "You already have an EMI with that name."
        : error.message,
    );
  }

  refresh();
  return { error: null, ok: true, version: prev.version + 1, values };
}

export async function deleteEmi(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_emis").delete().eq("id", id);
  refresh();
}

export async function addEmiPayment(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, [
    "emi_id",
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

  if (!uuid.test(values.emi_id)) return fail("Choose an EMI.");
  const amount = parseAmount(values.amount);
  if (amount === null) return fail("Enter a valid amount.");
  if (!isValidDate(values.occurred_on)) return fail("Pick a valid date.");
  if (values.note.length > 200)
    return fail("Keep the note under 200 characters.");

  const supabase = await authedClient();
  const { error } = await supabase.from("finance_emi_payments").insert({
    emi_id: values.emi_id,
    amount,
    occurred_on: values.occurred_on,
    note: values.note || null,
  });
  if (error) return fail(error.message);

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteEmiPayment(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_emi_payments").delete().eq("id", id);
  refresh();
}
