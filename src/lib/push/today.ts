import "server-only";
import { formatMoney, todayISO, totalsOf } from "@/lib/finance";
import { sendPush } from "@/lib/push/server";
import { createClient } from "@/lib/supabase/server";

// Refreshes the pinned "today's spending" card in the notification shade.
// Quiet and best-effort: never blocks saving an entry.
export async function refreshSpendPin() {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (!userId) return;

    const { data: setting } = await supabase
      .from("reminder_settings")
      .select("enabled")
      .eq("kind", "spend_pin")
      .maybeSingle();
    if (!setting?.enabled) return;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    if (!subs?.length) return;

    const today = todayISO();
    const { data: rows } = await supabase
      .from("finance_transactions")
      .select("type, amount")
      .eq("occurred_on", today);
    const totals = totalsOf(
      (rows ?? []).map((r) => ({ type: r.type, amount: Number(r.amount) })),
    );

    const payload = {
      title: `Spent today: ${formatMoney(totals.expense)}`,
      body:
        totals.income > 0
          ? `${formatMoney(totals.income)} came in · tap + to add another entry`
          : "Tap + to add an entry",
      url: "/financial/daily",
      tag: "spend-pin",
      sticky: true,
      silent: true,
      actions: [
        { action: "add", title: "+ Add entry", url: "/financial/daily?add=entry" },
        { action: "open", title: "Open day", url: "/financial/daily" },
      ],
    };

    for (const sub of subs) {
      const status = await sendPush(sub, payload);
      if (status === "gone")
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
    }
  } catch {
    // Notifications are a nicety; a failure here must not break the app
  }
}

// Replaces the pinned card with a short note that it is off, so the old
// card doesn't linger with stale numbers.
export async function clearSpendPin() {
  try {
    const supabase = await createClient();
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    for (const sub of subs ?? [])
      await sendPush(sub, {
        title: "Spending card turned off",
        body: "Swipe this away. Turn it back on in Settings.",
        url: "/settings",
        tag: "spend-pin",
        silent: true,
      });
  } catch {
    // best effort
  }
}
