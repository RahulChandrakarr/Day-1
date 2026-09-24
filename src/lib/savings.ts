// Savings and investments add up across two halves: the accounts kept by hand
// (mutual funds, FDs, gold) and the stocks synced from Groww. The pages under
// /financial/savings all need the same sums, so they live here.

import type { AccountSummary } from "@/lib/investments";
import { portfolioTotals, type HoldingSummary } from "@/lib/portfolio";

export function combinedTotals(
  accounts: AccountSummary[],
  stocks: HoldingSummary[],
) {
  const stockTotals = portfolioTotals(stocks);
  const invested = accounts.reduce((sum, a) => sum + a.invested, 0) + stockTotals.invested;
  const current = accounts.reduce((sum, a) => sum + a.current, 0) + stockTotals.worth;
  const gain = current - invested;
  return {
    invested,
    current,
    gain,
    gainPct: invested > 0 ? (gain / invested) * 100 : null,
    stocks: stockTotals,
  };
}

export type Slice = { label: string; value: number; color: string };

// Where the money sits: stocks as one slice, then each account
export function allocationSlices(
  accounts: AccountSummary[],
  stockWorth: number,
): Slice[] {
  return [
    ...(stockWorth > 0 ? [{ label: "Stocks", value: stockWorth, color: "var(--ember)" }] : []),
    ...accounts
      .filter((a) => a.current > 0)
      .map((a) => ({ label: a.name, value: a.current, color: `var(--cat-${a.color})` })),
  ];
}

export const signedMoney = (n: number, format: (v: number) => string) =>
  `${n < 0 ? "−" : "+"}${format(Math.abs(n))}`;

export const returnsHint = (gain: number, invested: number) =>
  invested > 0
    ? `${gain < 0 ? "−" : "+"}${Math.abs((gain / invested) * 100).toFixed(1)}% overall`
    : "Update values to see returns";
