import AccountList from "@/components/finance/savings/account-list";
import { AddAccountForm } from "@/components/finance/savings/savings-forms";
import { FigureGrid, Rail, Stack } from "@/components/ui/kit";
import { formatMoney, formatMonthShort, todayISO } from "@/lib/finance";
import { getAccounts, getInvestmentEntries, getMonthBudgets } from "@/lib/finance-queries";
import { accountSummaries, netSaved } from "@/lib/investments";
import { returnsHint, signedMoney } from "@/lib/savings";

// Everything saved by hand: mutual funds and SIPs, fixed deposits, gold. Groww's
// API can't see any of it, so these are kept up to date here.
export default async function FundsPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const [accounts, entries, monthBudgets] = await Promise.all([
    getAccounts(),
    getInvestmentEntries(),
    getMonthBudgets(Number(today.slice(0, 4))),
  ]);
  const summaries = accountSummaries(accounts, entries);
  const invested = summaries.reduce((sum, a) => sum + a.invested, 0);
  const current = summaries.reduce((sum, a) => sum + a.current, 0);
  const gain = current - invested;
  const savedThisMonth = netSaved(entries.filter((e) => e.occurred_on.startsWith(month)));
  const monthTarget =
    monthBudgets.find((b) => b.period_key === month)?.savings_target ?? null;

  return (
    <Stack>
      <FigureGrid
        items={[
          {
            label: "Worth now",
            value: formatMoney(current),
            hint: `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`,
          },
          { label: "Put in", value: formatMoney(invested), hint: "Deposits minus withdrawals" },
          {
            label: "Returns",
            value: signedMoney(gain, formatMoney),
            hint: returnsHint(gain, invested),
            tone: gain > 0 ? "good" : gain < 0 ? "bad" : undefined,
          },
          {
            label: `Saved in ${formatMonthShort(month)}`,
            value: signedMoney(savedThisMonth, formatMoney).replace("+", ""),
            hint:
              monthTarget !== null
                ? `of ${formatMoney(monthTarget)} target`
                : "No savings target set",
            tone: monthTarget !== null && savedThisMonth >= monthTarget ? "good" : undefined,
          },
        ]}
      />

      <Rail aside={<AddAccountForm startOpen={accounts.length === 0} />}>
        <AccountList accounts={summaries} />
      </Rail>
    </Stack>
  );
}
