// Stocks synced from Groww: the sums the pages and the assistant both quote.
// Worth is only as fresh as the last sync, so every total carries that time.

export type Holding = {
  id: string;
  isin: string;
  symbol: string;
  name: string | null;
  exchange: "NSE" | "BSE";
  quantity: number;
  average_price: number;
  last_price: number | null;
  day_change_perc: number | null;
  priced_at: string | null;
};

export type PortfolioSync = {
  synced_at: string | null;
  status: "ok" | "failed";
  message: string | null;
  holdings: number;
};

export type HoldingSummary = Holding & {
  invested: number;
  worth: number;
  gain: number;
  gainPct: number | null;
};

// Shares times price lands on values like 29640.000000000004; paise is as fine
// as money gets here
const paise = (n: number) => Math.round(n * 100) / 100;

// Biggest position first, so the page leads with what matters
export function holdingSummaries(holdings: Holding[]): HoldingSummary[] {
  return holdings
    .map((h) => {
      const invested = paise(h.quantity * h.average_price);
      // Without a price, a holding is worth what was put in rather than nothing
      const worth = h.last_price === null ? invested : paise(h.quantity * h.last_price);
      const gain = paise(worth - invested);
      return {
        ...h,
        invested,
        worth,
        gain,
        gainPct: invested > 0 ? (gain / invested) * 100 : null,
      };
    })
    .sort((a, b) => b.worth - a.worth);
}

export function portfolioTotals(summaries: HoldingSummary[]) {
  const invested = paise(summaries.reduce((sum, h) => sum + h.invested, 0));
  const worth = paise(summaries.reduce((sum, h) => sum + h.worth, 0));
  const gain = paise(worth - invested);
  return {
    invested,
    worth,
    gain,
    gainPct: invested > 0 ? (gain / invested) * 100 : null,
    unpriced: summaries.filter((h) => h.last_price === null).length,
    count: summaries.length,
  };
}

// "just now", "12 min ago", "3 hours ago", "yesterday", "5 days ago"
export function timeAgo(iso: string | null, now: number = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
