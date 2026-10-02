import type { Metadata } from "next";
import BankMessages from "@/components/settings/bank-messages";
import { todayISO } from "@/lib/finance";
import { getBankAccounts, getInboxToken } from "@/lib/finance-queries";
import { createClient } from "@/lib/supabase/server";
import type { InboxItem } from "@/lib/finance-queries";

export const metadata: Metadata = {
  title: "Bank messages · Day One",
};

// Everything needed to set the phone up, and to see whether it worked.
export default async function BankMessagesPage() {
  const supabase = await createClient();
  const [token, accounts, recent] = await Promise.all([
    getInboxToken(),
    getBankAccounts(todayISO()),
    supabase
      .from("finance_inbox")
      .select("id, sender, body, received_at, direction, amount, merchant, occurred_on, bank_account_id, status")
      .order("received_at", { ascending: false })
      .limit(15)
      .returns<(InboxItem & { status: string; amount: number | string | null })[]>(),
  ]);

  return (
    <BankMessages
      token={token}
      accounts={accounts}
      recent={(recent.data ?? []).map((i) => ({
        ...i,
        amount: i.amount === null ? null : Number(i.amount),
      }))}
    />
  );
}
