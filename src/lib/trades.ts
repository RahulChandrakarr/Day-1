// The trading journal's arithmetic. Every number here comes from what the
// user recorded — nothing predicts, rates or recommends anything.

import { tradeCharges, entryCharges, type Segment } from "@/lib/charges";

export type TradeKind = "intraday" | "swing" | "investment";
export type TradeSide = "long" | "short";
export type ExitReason = "target" | "stop" | "manual" | "other";

export type Trade = {
  id: string;
  symbol: string;
  kind: TradeKind;
  side: TradeSide;
  quantity: number;
  entry_price: number;
  entry_on: string;
  stop_price: number | null;
  target_price: number | null;
  setup: string | null;
  thesis: string | null;
  exit_price: number | null;
  exit_on: string | null;
  exit_reason: ExitReason | null;
  review: string | null;
  costs: number | null;
  screenshot_path: string | null;
  stop_moves: number;
};

export const KINDS: { kind: TradeKind; label: string }[] = [
  { kind: "intraday", label: "Intraday" },
  { kind: "swing", label: "Swing" },
  { kind: "investment", label: "Investment" },
];

export const EXIT_REASONS: { reason: ExitReason; label: string }[] = [
  { reason: "target", label: "Hit my target" },
  { reason: "stop", label: "Hit my stop" },
  { reason: "manual", label: "Closed it myself" },
  { reason: "other", label: "Something else" },
];

const round = (n: number) => Math.round(n * 100) / 100;
const segmentOf = (kind: TradeKind): Segment => (kind === "intraday" ? "intraday" : "delivery");

export const isClosed = (t: Trade) => t.exit_price !== null && t.exit_on !== null;

// What the trade risked when it was opened: the distance to the stop
export function plannedRisk(t: Trade) {
  if (t.stop_price === null) return null;
  const perShare = t.side === "long" ? t.entry_price - t.stop_price : t.stop_price - t.entry_price;
  return perShare > 0 ? round(perShare * t.quantity) : null;
}

// Profit after charges. Null while the trade is open.
export function tradePnl(t: Trade) {
  if (t.exit_price === null) return null;
  const entryValue = t.entry_price * t.quantity;
  const exitValue = t.exit_price * t.quantity;
  const gross = round(t.side === "long" ? exitValue - entryValue : entryValue - exitValue);
  // A short sells first, but each side is charged the same way
  const buyValue = t.side === "long" ? entryValue : exitValue;
  const sellValue = t.side === "long" ? exitValue : entryValue;
  const estimated = t.costs === null;
  const costs = t.costs ?? tradeCharges(buyValue, sellValue, segmentOf(t.kind));
  return { gross, costs, net: round(gross - costs), estimated };
}

// What the entry alone has cost so far, for a trade still open
export function openCosts(t: Trade) {
  return entryCharges(t.entry_price * t.quantity, segmentOf(t.kind), t.side === "short");
}

// Profit measured in units of the risk taken. The number that says whether the
// winners are paying for the losers: +2R means it made twice what it risked.
export function rMultiple(t: Trade) {
  const pnl = tradePnl(t);
  const risk = plannedRisk(t);
  if (!pnl || risk === null || risk === 0) return null;
  return round(pnl.net / risk);
}

export function holdingDays(t: Trade, today?: string) {
  const end = t.exit_on ?? today;
  if (!end) return null;
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${t.entry_on}T00:00:00Z`).getTime();
  return Math.max(Math.round(ms / 86_400_000), 0);
}

export type TradeStats = {
  closed: number;
  open: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  // What an average trade returns, given how often they win and by how much
  expectancy: number | null;
  profitFactor: number | null;
  net: number;
  avgR: number | null;
  avgDays: number | null;
  stopMoves: number;
};

export function tradeStats(trades: Trade[]): TradeStats {
  const closed = trades.filter(isClosed);
  const pnls = closed.map((t) => tradePnl(t)!.net);
  const wins = pnls.filter((n) => n > 0);
  const losses = pnls.filter((n) => n < 0);
  const mean = (list: number[]) =>
    list.length ? round(list.reduce((sum, n) => sum + n, 0) / list.length) : null;
  const rs = closed.map(rMultiple).filter((r): r is number => r !== null);
  const days = closed.map((t) => holdingDays(t)).filter((d): d is number => d !== null);
  const lossTotal = Math.abs(losses.reduce((sum, n) => sum + n, 0));
  const winTotal = wins.reduce((sum, n) => sum + n, 0);

  return {
    closed: closed.length,
    open: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? round((wins.length / closed.length) * 100) : null,
    avgWin: mean(wins),
    avgLoss: mean(losses.map(Math.abs)),
    expectancy: mean(pnls),
    profitFactor: lossTotal > 0 ? round(winTotal / lossTotal) : null,
    net: round(pnls.reduce((sum, n) => sum + n, 0)),
    avgR: mean(rs),
    avgDays: mean(days),
    stopMoves: trades.reduce((sum, t) => sum + t.stop_moves, 0),
  };
}

// Which setups and which horizons actually pay, from his own record.
// Biggest total first; unnamed setups are grouped as "No setup named".
export function groupTrades(trades: Trade[], by: "setup" | "kind") {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const name = by === "kind" ? t.kind : (t.setup?.trim() || "No setup named");
    groups.set(name, [...(groups.get(name) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([name, own]) => ({ name, trades: own, stats: tradeStats(own) }))
    .sort((a, b) => b.stats.net - a.stats.net);
}
