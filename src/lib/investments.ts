// Savings & investment account types and helpers (safe for server and client).

export type AccountKind =
  | "savings"
  | "fd"
  | "rd"
  | "mutual_fund"
  | "stocks"
  | "ppf"
  | "epf"
  | "nps"
  | "gold"
  | "crypto"
  | "real_estate"
  | "other";

export const ACCOUNT_KINDS: { kind: AccountKind; label: string }[] = [
  { kind: "savings", label: "Savings account" },
  { kind: "fd", label: "Fixed deposit" },
  { kind: "rd", label: "Recurring deposit" },
  { kind: "mutual_fund", label: "Mutual fund / SIP" },
  { kind: "stocks", label: "Stocks" },
  { kind: "ppf", label: "PPF" },
  { kind: "epf", label: "EPF" },
  { kind: "nps", label: "NPS" },
  { kind: "gold", label: "Gold" },
  { kind: "crypto", label: "Crypto" },
  { kind: "real_estate", label: "Property" },
  { kind: "other", label: "Other" },
];

export const accountKindLabel = (kind: AccountKind) =>
  ACCOUNT_KINDS.find((k) => k.kind === kind)?.label ?? "Other";

export type InvestmentKind = "deposit" | "withdrawal" | "value";

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  color: number;
  sip_day: number | null; // day of month the SIP / RD is deducted
  sip_amount: number | null;
};

// Account types that take a fixed amount every month
export const isRecurringKind = (kind: AccountKind) =>
  kind === "mutual_fund" || kind === "rd";

export function ordinal(day: number) {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] ?? "th"}`;
}

// This month's deduction date if it has passed, otherwise today.
export function sipDate(day: number, today: string) {
  const month = today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const date = `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
  return date <= today ? date : today;
}

export type InvestmentEntry = {
  id: string;
  account_id: string;
  kind: InvestmentKind;
  amount: number;
  note: string | null;
  occurred_on: string; // YYYY-MM-DD
  created_at: string;
};

export type AccountSummary = Account & {
  invested: number; // deposits − withdrawals
  current: number; // latest value, adjusted for later deposits/withdrawals
  gain: number;
  valuedOn: string | null; // date of the latest value update
  entries: InvestmentEntry[]; // newest first
};

const newestFirst = (a: InvestmentEntry, b: InvestmentEntry) =>
  b.occurred_on.localeCompare(a.occurred_on) ||
  b.created_at.localeCompare(a.created_at);

export function accountSummaries(
  accounts: Account[],
  entries: InvestmentEntry[],
): AccountSummary[] {
  return accounts.map((account) => {
    const own = entries
      .filter((e) => e.account_id === account.id)
      .sort(newestFirst);
    const invested = netSaved(own);
    const latestValue = own.find((e) => e.kind === "value");
    let current = invested;
    if (latestValue) {
      // Money moved after the valuation date still counts toward the value
      const after = own.filter(
        (e) =>
          e.kind !== "value" &&
          (e.occurred_on > latestValue.occurred_on ||
            (e.occurred_on === latestValue.occurred_on &&
              e.created_at > latestValue.created_at)),
      );
      current = latestValue.amount + netSaved(after);
    }
    return {
      ...account,
      invested,
      current,
      gain: current - invested,
      valuedOn: latestValue?.occurred_on ?? null,
      entries: own,
    };
  });
}

// Money put in minus money taken out (value updates ignored).
export function netSaved(entries: Pick<InvestmentEntry, "kind" | "amount">[]) {
  let total = 0;
  for (const e of entries) {
    if (e.kind === "deposit") total += e.amount;
    else if (e.kind === "withdrawal") total -= e.amount;
  }
  return total;
}
