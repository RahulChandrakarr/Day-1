import Link from "next/link";
import AllocationCard from "@/components/finance/savings/allocation-card";
import { Card, CardGrid, FigureGrid, Stack } from "@/components/ui/kit";
import { formatMoney, formatMonthShort, todayISO } from "@/lib/finance";
import {
  getAccounts,
  getHoldings,
  getInvestmentEntries,
  getMonthBudgets,
} from "@/lib/finance-queries";
import { accountSummaries, netSaved } from "@/lib/investments";
import { holdingSummaries } from "@/lib/portfolio";
import { allocationSlices, combinedTotals, returnsHint, signedMoney } from "@/lib/savings";

// Where everything put away is summed up. The detail lives on the three pages
// underneath: stocks, funds and FDs, and the month-by-month history.
export default async function SavingsPage() {
  const today = todayISO();
  const month = today.slice(0, 7);

  const [accounts, entries, monthBudgets, holdings] = await Promise.all([
    getAccounts(),
    getInvestmentEntries(),
    getMonthBudgets(Number(today.slice(0, 4))),
    getHoldings(),
  ]);
  const summaries = accountSummaries(accounts, entries);
  const stocks = holdingSummaries(holdings);
  const totals = combinedTotals(summaries, stocks);
  const savedThisMonth = netSaved(entries.filter((e) => e.occurred_on.startsWith(month)));
  const monthTarget =
    monthBudgets.find((b) => b.period_key === month)?.savings_target ?? null;
  const accountWorth = summaries.reduce((sum, a) => sum + a.current, 0);

  const pages = [
    {
      href: "/financial/savings/stocks",
      title: "Stocks",
      line: stocks.length
        ? `${stocks.length} ${stocks.length === 1 ? "holding" : "holdings"} · ${formatMoney(totals.stocks.worth)}`
        : "Nothing synced from Groww yet",
    },
    {
      href: "/financial/savings/funds",
      title: "Funds & FDs",
      line: accounts.length
        ? `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"} · ${formatMoney(accountWorth)}`
        : "Add a fund, FD or anything else you save into",
    },
    {
      href: "/financial/savings/history",
      title: "History",
      line: `${formatMoney(Math.abs(savedThisMonth))} ${savedThisMonth < 0 ? "taken out" : "saved"} in ${formatMonthShort(month)}`,
    },
  ];

  return (
    <Stack>
      <FigureGrid
        items={[
          {
            label: "Worth now",
            value: formatMoney(totals.current),
            hint:
              [
                stocks.length ? `${stocks.length} ${stocks.length === 1 ? "stock" : "stocks"}` : "",
                accounts.length ? `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}` : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Nothing yet",
          },
          {
            label: "Put in",
            value: formatMoney(totals.invested),
            hint: "Deposits and buys, minus what came out",
          },
          {
            label: "Returns",
            value: signedMoney(totals.gain, formatMoney),
            hint: returnsHint(totals.gain, totals.invested),
            tone: totals.gain > 0 ? "good" : totals.gain < 0 ? "bad" : undefined,
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

      <CardGrid layout="triple">
        {pages.map((page) => (
          <Link key={page.href} href={page.href} className="min-w-0">
            <Card className="flex h-full items-center gap-3 transition hover:border-paper/25">
              <span className="min-w-0 flex-1">
                <span className="block font-bold tracking-tight text-[19px]">{page.title}</span>
                <span className="block truncate text-sm text-paper/55">{page.line}</span>
              </span>
              <span aria-hidden className="shrink-0 text-ember">
                →
              </span>
            </Card>
          </Link>
        ))}
      </CardGrid>

      <AllocationCard slices={allocationSlices(summaries, totals.stocks.worth)} />
    </Stack>
  );
}
