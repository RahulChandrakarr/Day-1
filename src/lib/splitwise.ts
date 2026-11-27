import "server-only";
import { APP_TIMEZONE, LOCALE } from "@/lib/finance";

// Reads a person's Splitwise account with the personal API key they pasted in
// Settings -> Integrations. Read-only: nothing is written to Splitwise, and
// nothing from Splitwise is copied into Day One's own money records.
// API reference: https://dev.splitwise.com (the key is sent as a Bearer token).

const API = "https://secure.splitwise.com/api/v3.0";

export type SplitwiseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; keyRejected?: boolean };

// One currency's balance with one friend. Positive: the friend owes you.
// Negative: you owe the friend. Splitwise's docs don't say which way the sign
// points; this is how Splitwise's own app reads it.
export type Balance = { currency: string; amount: number };

export type SplitwiseFriend = { id: number; name: string; balances: Balance[] };

export type SplitwiseBalances = {
  // Friends with something outstanding, the largest amounts first
  open: SplitwiseFriend[];
  settled: number;
  // Per currency, never converted: what friends owe you and what you owe them
  totals: { currency: string; owedToYou: number; youOwe: number; owedBy: number; owing: number }[];
  fetchedAt: string;
};

type RawBalance = { currency_code?: string | null; amount?: string | number | null };
type RawPerson = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};
type RawFriend = RawPerson & { balance?: RawBalance[] | null };

async function call<T>(key: string, path: string): Promise<SplitwiseResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API}/${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "Couldn't reach Splitwise. Try again in a moment." };
  }
  if (response.status === 401 || response.status === 403)
    return {
      ok: false,
      keyRejected: true,
      error: "Splitwise didn't accept this key. Make a new one on Splitwise and paste it again.",
    };
  if (response.status === 429)
    return { ok: false, error: "Splitwise is busy right now. Try again in a minute." };
  if (!response.ok)
    return { ok: false, error: `Splitwise answered with an error (${response.status}). Try again later.` };
  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: "Splitwise sent back something unreadable. Try again later." };
  }
}

const nameOf = (person: RawPerson) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
  person.email ||
  "Someone on Splitwise";

// Whose account the key opens: also the check that a pasted key works
export async function getSplitwiseUser(
  key: string,
): Promise<SplitwiseResult<{ id: number; name: string }>> {
  const result = await call<{ user?: RawPerson }>(key, "get_current_user");
  if (!result.ok) return result;
  const user = result.data.user;
  if (!user?.id) return { ok: false, error: "Splitwise didn't say whose account this is." };
  return { ok: true, data: { id: user.id, name: nameOf(user) } };
}

// Amounts arrive as strings ("414.5"), one entry per currency
export function parseBalances(raw: RawBalance[] | null | undefined): Balance[] {
  const sums = new Map<string, number>();
  for (const entry of raw ?? []) {
    const currency = String(entry.currency_code ?? "").trim().toUpperCase();
    const amount = Number(entry.amount);
    if (!currency || !Number.isFinite(amount)) continue;
    sums.set(currency, (sums.get(currency) ?? 0) + amount);
  }
  return [...sums]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .filter((b) => Math.abs(b.amount) >= 0.01);
}

export function summarise(friends: RawFriend[], fetchedAt: string): SplitwiseBalances {
  const all = friends.map((f) => ({ id: f.id, name: nameOf(f), balances: parseBalances(f.balance) }));
  const open = all
    .filter((f) => f.balances.length > 0)
    .sort(
      (a, b) =>
        Math.max(...b.balances.map((x) => Math.abs(x.amount))) -
        Math.max(...a.balances.map((x) => Math.abs(x.amount))),
    );

  const byCurrency = new Map<string, SplitwiseBalances["totals"][number]>();
  for (const friend of open)
    for (const { currency, amount } of friend.balances) {
      const row = byCurrency.get(currency) ?? { currency, owedToYou: 0, youOwe: 0, owedBy: 0, owing: 0 };
      if (amount > 0) {
        row.owedToYou += amount;
        row.owedBy += 1;
      } else {
        row.youOwe += -amount;
        row.owing += 1;
      }
      byCurrency.set(currency, row);
    }
  const totals = [...byCurrency.values()].map((t) => ({
    ...t,
    owedToYou: Math.round(t.owedToYou * 100) / 100,
    youOwe: Math.round(t.youOwe * 100) / 100,
  }));

  return { open, settled: all.length - open.length, totals, fetchedAt };
}

export async function getSplitwiseBalances(key: string): Promise<SplitwiseResult<SplitwiseBalances>> {
  const result = await call<{ friends?: RawFriend[] }>(key, "get_friends");
  if (!result.ok) return result;
  return { ok: true, data: summarise(result.data.friends ?? [], new Date().toISOString()) };
}

// "₹450", "₹1,120.50", "$12.40": the friend's own currency, never converted
export function formatBalance(currency: string, amount: number) {
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // A code Intl doesn't know (Splitwise allows a few): show it plainly
    return `${currency} ${amount.toFixed(digits)}`;
  }
}

// "10:42 am", in India time whatever the server's clock zone
export function formatFetchedAt(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
