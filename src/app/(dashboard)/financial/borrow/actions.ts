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

const KINDS = ["borrowed", "repaid", "lent", "received"];

export async function addDebt(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formFields(formData, [
    "kind",
    "person",
    "amount",
    "occurred_on",
    "note",
    "in_balance",
    "bank_account_id",
  ]);
  const fail = (error: string): FormState => ({
    error,
    ok: false,
    version: prev.version + 1,
    values,
  });

  const name = values.person.replace(/\s+/g, " ");
  if (!KINDS.includes(values.kind)) return fail("Choose what happened.");
  if (!name) return fail("Who was it with?");
  if (name.length > 60) return fail("Keep the name under 60 characters.");
  const amount = parseAmount(values.amount);
  if (amount === null || amount >= 1e10)
    return fail("Enter an amount greater than 0.");
  if (!isValidDate(values.occurred_on)) return fail("Pick a valid date.");
  if (values.note.length > 200)
    return fail("Keep the note under 200 characters.");
  if (values.in_balance !== "yes" && values.in_balance !== "no")
    return fail("Choose whether to count this in your net balance.");

  const supabase = await authedClient();

  // Reuse the person if the name already exists (any capitalisation)
  const { data: people, error: peopleError } = await supabase
    .from("finance_people")
    .select("id, name");
  if (peopleError) return fail(peopleError.message);
  let personId = people?.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  )?.id;
  if (!personId) {
    const { data: created, error } = await supabase
      .from("finance_people")
      .insert({ name })
      .select("id")
      .single();
    if (error) return fail(error.message);
    personId = created.id;
  }

  const { error } = await supabase.from("finance_debts").insert({
    person_id: personId,
    kind: values.kind,
    amount,
    occurred_on: values.occurred_on,
    note: values.note || null,
    in_balance: values.in_balance === "yes",
    bank_account_id: uuid.test(values.bank_account_id) ? values.bank_account_id : null,
  });
  if (error) return fail(error.message);

  refresh();
  return { error: null, ok: true, version: prev.version + 1 };
}

export async function deleteDebt(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_debts").delete().eq("id", id);
  refresh();
}

// Removes the person, their history and any plan lines for them.
export async function deletePerson(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("finance_people").delete().eq("id", id);
  refresh();
}
