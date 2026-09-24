import TradeJournal from "@/components/finance/trades/trade-journal";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/finance";
import { getTrades } from "@/lib/finance-queries";

// The trading journal: what was planned, what happened, and what that says
// about which of his setups actually pay.
export default async function TradesPage() {
  const [{ profile }, trades] = await Promise.all([requireProfile(), getTrades()]);
  return <TradeJournal trades={trades} today={todayISO()} userId={profile.id} />;
}
