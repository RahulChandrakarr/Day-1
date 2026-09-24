// What a trade actually costs in India, so profit in the journal is profit
// after charges rather than the gross number.
//
// Groww's published rates (2026): brokerage is the lower of ₹20 or 0.1% per
// executed order with a ₹5 floor; NSE transaction 0.00297%; SEBI 0.0001%;
// stamp duty 0.015% on the buy side only; STT 0.1% on a delivery sell and
// 0.025% on an intraday sell; 18% GST on the fee components (not on STT or
// stamp duty); about ₹20 for the demat debit when delivery shares are sold.
// These are estimates — a contract note is the truth.

export type Segment = "delivery" | "intraday";

const BROKERAGE_PCT = 0.001;
const BROKERAGE_CAP = 20;
const BROKERAGE_FLOOR = 5;
const NSE_TXN_PCT = 0.0000297;
const SEBI_PCT = 0.000001;
const STAMP_PCT = 0.00015;
const STT_DELIVERY_SELL = 0.001;
const STT_INTRADAY_SELL = 0.00025;
const GST = 0.18;
const DP_PER_SELL = 20;

const round = (n: number) => Math.round(n * 100) / 100;

const brokerage = (value: number) =>
  value <= 0 ? 0 : Math.max(Math.min(value * BROKERAGE_PCT, BROKERAGE_CAP), BROKERAGE_FLOOR);

// One side of a trade: a buy or a sell
function sideCharges(value: number, segment: Segment, isSell: boolean) {
  if (value <= 0) return { fees: 0, taxes: 0 };
  const broker = brokerage(value);
  const exchange = value * NSE_TXN_PCT;
  const sebi = value * SEBI_PCT;
  const dp = isSell && segment === "delivery" ? DP_PER_SELL : 0;
  const fees = broker + exchange + sebi + dp;
  const stt = isSell
    ? value * (segment === "delivery" ? STT_DELIVERY_SELL : STT_INTRADAY_SELL)
    : 0;
  const stamp = isSell ? 0 : value * STAMP_PCT;
  return { fees: fees + fees * GST, taxes: stt + stamp };
}

// Charges for a round trip. A short sells first, but the same rates apply to
// each side, so only the values matter.
export function tradeCharges(
  buyValue: number,
  sellValue: number,
  segment: Segment = "delivery",
) {
  const buy = sideCharges(buyValue, segment, false);
  const sell = sideCharges(sellValue, segment, true);
  return round(buy.fees + buy.taxes + sell.fees + sell.taxes);
}

// What one side costs, for a trade that is still open
export function entryCharges(value: number, segment: Segment = "delivery", isSell = false) {
  const { fees, taxes } = sideCharges(value, segment, isSell);
  return round(fees + taxes);
}
