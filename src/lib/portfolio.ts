// Stocks synced from Groww: the sums the pages and the assistant both quote.
// Worth is only as fresh as the last sync, so every total carries that time.

export type HoldingMode = "long_term" | "swing";

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
  mode: HoldingMode;
  bought_on: string | null;
  target_price: number | null;
  stop_price: number | null;
};

export type Lot = {
  id: string;
  symbol: string;
  quantity: number;
  price: number;
  bought_on: string;
  estimated: boolean;
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

// Indian listed equity, FY 2026-27. Sold within 12 months, gains are taxed at
// 20% (section 111A); after 12 months at 12.5% on whatever exceeds ₹1.25 lakh
// of long-term gains in the financial year (section 112A). These are estimates
// for timing a sale, not tax advice, and they ignore brokerage and STT.
export const STCG_RATE = 0.2;
export const LTCG_RATE = 0.125;
export const LTCG_EXEMPTION = 125_000;

const dayMs = 86_400_000;
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Long term starts the day after a full year of holding
export function longTermFrom(boughtOn: string) {
  const d = asDate(boughtOn);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

export function daysBetween(from: string, to: string) {
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / dayMs);
}

// The Indian financial year runs April to March
export function financialYear(on: string) {
  const [y, m] = on.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return { label: `${start}-${String((start + 1) % 100).padStart(2, "0")}`, from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

export type LotTiming = {
  lot: Lot;
  daysHeld: number;
  longTermOn: string;
  daysToLongTerm: number;
  isLongTerm: boolean;
  gain: number;
  // What the tax would be if sold today, and if sold once it turns long term.
  // The exemption is left out here: it applies across the year, not per lot.
  taxNow: number;
  taxLater: number;
  saving: number;
};

export function lotTiming(lot: Lot, lastPrice: number | null, today: string): LotTiming {
  const price = lastPrice ?? lot.price;
  const gain = paise(lot.quantity * (price - lot.price));
  const longTermOn = longTermFrom(lot.bought_on);
  const daysToLongTerm = Math.max(daysBetween(today, longTermOn), 0);
  const isLongTerm = daysToLongTerm === 0;
  const taxNow = gain <= 0 ? 0 : Math.round(gain * (isLongTerm ? LTCG_RATE : STCG_RATE));
  const taxLater = gain <= 0 ? 0 : Math.round(gain * LTCG_RATE);
  return {
    lot,
    daysHeld: daysBetween(lot.bought_on, today),
    longTermOn,
    daysToLongTerm,
    isLongTerm,
    gain,
    taxNow,
    taxLater,
    saving: taxNow - taxLater,
  };
}

// The year's long-term headroom. Only gains actually taken are taxed, so this
// is about unrealised gains and says so.
export function exemptionView(timings: LotTiming[], today: string) {
  const year = financialYear(today);
  const longTermGain = paise(
    timings.filter((t) => t.isLongTerm && t.gain > 0).reduce((sum, t) => sum + t.gain, 0),
  );
  return {
    year: year.label,
    longTermGain,
    headroom: paise(Math.max(LTCG_EXEMPTION - longTermGain, 0)),
    overExemption: longTermGain > LTCG_EXEMPTION,
  };
}

// The purchases behind one holding. With no recorded lots, the date the user
// entered stands for the whole position.
export function holdingLots(holding: Holding, lots: Lot[]): Lot[] {
  const own = lots.filter((l) => l.symbol === holding.symbol);
  if (own.length > 0) return own;
  if (!holding.bought_on) return [];
  return [
    {
      id: holding.id,
      symbol: holding.symbol,
      quantity: holding.quantity,
      price: holding.average_price,
      bought_on: holding.bought_on,
      estimated: false,
    },
  ];
}

// What the tax clock says about one holding: the next lot to turn long term,
// and what waiting for it is worth.
export function holdingTiming(holding: Holding, lots: Lot[], today: string) {
  const timings = holdingLots(holding, lots).map((l) => lotTiming(l, holding.last_price, today));
  if (timings.length === 0) return null;
  const waiting = timings.filter((t) => !t.isLongTerm && t.saving > 0);
  const next = waiting.sort((a, b) => a.daysToLongTerm - b.daysToLongTerm)[0] ?? null;
  return {
    timings,
    next,
    saving: waiting.reduce((sum, t) => sum + t.saving, 0),
    allLongTerm: timings.every((t) => t.isLongTerm),
    daysHeld: Math.max(...timings.map((t) => t.daysHeld)),
  };
}

// How far a swing trade is from the lines the user drew
export function swingView(holding: Holding) {
  const price = holding.last_price;
  if (price === null) return null;
  const to = (level: number | null) =>
    level === null ? null : { level, awayPct: ((level - price) / price) * 100 };
  return { target: to(holding.target_price), stop: to(holding.stop_price) };
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
