import HoldingsCard from "@/components/finance/savings/holdings-card";
import { FigureGrid, Stack } from "@/components/ui/kit";
import { formatMoney, todayISO } from "@/lib/finance";
import { getHoldingLots, getHoldings, getPortfolioSync } from "@/lib/finance-queries";
import { growwConfigured } from "@/lib/groww";
import { holdingSummaries, portfolioTotals, timeAgo } from "@/lib/portfolio";
import { returnsHint, signedMoney } from "@/lib/savings";

// Stocks held in the demat account, with the mode and the lines the user set
// for each one.
export default async function StocksPage() {
  const today = todayISO();
  const [holdings, lots, sync] = await Promise.all([
    getHoldings(),
    getHoldingLots(),
    getPortfolioSync(),
  ]);
  const stocks = holdingSummaries(holdings);
  const totals = portfolioTotals(stocks);
  const swing = stocks.filter((h) => h.mode === "swing").length;

  return (
    <Stack>
      <FigureGrid
        items={[
          {
            label: "Worth now",
            value: formatMoney(totals.worth),
            hint: totals.unpriced
              ? `${totals.unpriced} of ${totals.count} without a live price`
              : `${totals.count} ${totals.count === 1 ? "holding" : "holdings"}`,
          },
          { label: "Put in", value: formatMoney(totals.invested), hint: "At your average buy price" },
          {
            label: "Returns",
            value: signedMoney(totals.gain, formatMoney),
            hint: returnsHint(totals.gain, totals.invested),
            tone: totals.gain > 0 ? "good" : totals.gain < 0 ? "bad" : undefined,
          },
          {
            label: "Held as",
            value: `${totals.count - swing} long · ${swing} swing`,
            hint: "Set the mode on any holding",
          },
        ]}
      />

      <HoldingsCard
        holdings={stocks}
        lots={lots}
        today={today}
        syncedLabel={timeAgo(sync?.synced_at ?? null)}
        status={sync?.status ?? null}
        message={sync?.message ?? null}
        connected={growwConfigured()}
      />
    </Stack>
  );
}
