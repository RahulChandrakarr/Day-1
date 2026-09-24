import "server-only";
import { createHash, createHmac } from "node:crypto";

// Groww's trading API, read-only: the demat holdings and their live prices.
// Docs: https://groww.in/trade-api/docs/curl
//
// Auth is two-step. The credentials sit in server env vars (they can place
// real orders, so they never touch the database or the browser) and buy a
// daily access token, which every call carries. Token requests are capped at
// 150 a day, so the token is kept in memory until it expires.
//
// Groww offers two ways to sign in, and the pair you were given decides which:
// an API secret (hashed with a timestamp) or a TOTP secret from an
// authenticator app (base32, six digits every 30 seconds).

const BASE = "https://api.groww.in/v1";
const TIMEOUT = 12_000;

export type GrowwHolding = {
  isin: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
};

export type GrowwPrice = { lastPrice: number; dayChangePerc: number | null };

type Fail = { ok: false; error: string };
type Ok<T> = { ok: true } & T;
export type GrowwResult<T> = Ok<T> | Fail;

export const growwConfigured = () =>
  Boolean(
    process.env.GROWW_API_KEY &&
      (process.env.GROWW_API_SECRET || process.env.GROWW_TOTP_SECRET),
  );

// --- Signing in --------------------------------------------------------------

// The secret flow: sha256(secret + epoch seconds), which Groww checks against
// the same sum. The timestamp is good for ten minutes.
export function checksum(secret: string, timestampSeconds: number) {
  return createHash("sha256").update(`${secret}${timestampSeconds}`).digest("hex");
}

// --- TOTP -------------------------------------------------------------------
// Standard 30-second, 6-digit, SHA-1 TOTP (RFC 6238) from a base32 secret,
// which is what Groww's own SDK generates with pyotp's defaults.

function base32Decode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error("GROWW_TOTP_SECRET is not valid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

export function totp(secret: string, atMs: number = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  // Dynamic truncation: the low nibble of the last byte picks the 4 bytes to read
  const offset = digest[digest.length - 1] & 0x0f;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

// --- Access token -----------------------------------------------------------

let cached: { token: string; expiresAt: number } | null = null;

// Some responses wrap the data in `payload`, others return it at the top level
const envelope = (body: unknown) => {
  const b = (body ?? {}) as { payload?: unknown };
  return (b.payload ?? b) as Record<string, unknown>;
};

// Their expiry is an IST wall-clock string ("2026-09-25T06:00:00"), sometimes
// an epoch number instead
function expiryMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value))
    return value * (value > 1e12 ? 1 : 1000);
  if (typeof value === "string") {
    const iso = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}+05:30`;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) return parsed;
  }
  return nextExpiry();
}

// Groww expires tokens daily at 6am IST (00:30 UTC), whatever time they were made
function nextExpiry(now = Date.now()) {
  const expiry = new Date(now);
  expiry.setUTCHours(0, 30, 0, 0);
  if (expiry.getTime() <= now) expiry.setUTCDate(expiry.getUTCDate() + 1);
  return expiry.getTime();
}

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "X-API-VERSION": "1.0",
      Authorization: `Bearer ${token ?? ""}`,
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, body: body as { status?: string; payload?: unknown; error?: { message?: string }; message?: string } | null };
}

function why(status: number, body: { error?: { message?: string }; message?: string } | null) {
  const message = body?.error?.message ?? body?.message;
  if (status === 401 || status === 403)
    return message ?? "Groww refused the key. Check the API key and TOTP secret, and that the API subscription is active.";
  if (status === 429) return "Groww is rate limiting us. Try again in a minute.";
  if (status >= 500) return "Groww's API is having trouble. Try again shortly.";
  return message ?? `Groww returned ${status}.`;
}

async function accessToken(): Promise<GrowwResult<{ token: string }>> {
  if (cached && cached.expiresAt > Date.now() + 60_000)
    return { ok: true, token: cached.token };

  const key = process.env.GROWW_API_KEY;
  const secret = process.env.GROWW_API_SECRET;
  const totpSecret = process.env.GROWW_TOTP_SECRET;
  if (!key || (!secret && !totpSecret))
    return {
      ok: false,
      error: "Groww isn't set up: add GROWW_API_KEY and GROWW_API_SECRET (or GROWW_TOTP_SECRET).",
    };

  let payload: Record<string, string>;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    payload = { key_type: "approval", checksum: checksum(secret, timestamp), timestamp: String(timestamp) };
  } else {
    try {
      payload = { key_type: "totp", totp: totp(totpSecret!) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Bad TOTP secret." };
    }
  }

  const { status, body } = await call("/token/api/access", {
    method: "POST",
    token: key,
    body: JSON.stringify(payload),
  });
  if (status !== 200) return { ok: false, error: why(status, body) };

  const data = envelope(body) as { token?: string; access_token?: string; expiry?: unknown };
  const token = data.token ?? data.access_token;
  if (!token) return { ok: false, error: "Groww didn't return a token." };
  const expiresAt = expiryMs(data.expiry);
  cached = { token, expiresAt };
  return { ok: true, token };
}

// --- Read endpoints ---------------------------------------------------------

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export async function fetchHoldings(): Promise<GrowwResult<{ holdings: GrowwHolding[] }>> {
  const auth = await accessToken();
  if (!auth.ok) return auth;

  const { status, body } = await call("/holdings/user", { token: auth.token });
  if (status !== 200) return { ok: false, error: why(status, body) };

  const data = envelope(body);
  const rows = Array.isArray(data) ? data : ((data.holdings as unknown[]) ?? []);
  const holdings = (rows as Record<string, unknown>[])
    .map((row) => ({
      isin: String(row.isin ?? "").trim(),
      symbol: String(row.trading_symbol ?? "").trim().toUpperCase(),
      quantity: num(row.quantity),
      averagePrice: num(row.average_price),
    }))
    .filter((h) => h.symbol && h.isin && h.quantity > 0);
  return { ok: true, holdings };
}

// Holdings don't say which exchange, and the price endpoint needs one, so ask
// NSE for everything and retry whatever came back empty on BSE.
export async function fetchPrices(
  symbols: string[],
): Promise<GrowwResult<{ prices: Record<string, GrowwPrice & { exchange: "NSE" | "BSE" }> }>> {
  const prices: Record<string, GrowwPrice & { exchange: "NSE" | "BSE" }> = {};
  if (symbols.length === 0) return { ok: true, prices };

  const auth = await accessToken();
  if (!auth.ok) return auth;

  for (const exchange of ["NSE", "BSE"] as const) {
    const missing = symbols.filter((s) => !prices[s]);
    if (missing.length === 0) break;
    // The endpoint takes at most 50 instruments per call
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const query = new URLSearchParams({
        segment: "CASH",
        exchange_symbols: batch.map((s) => `${exchange}_${s}`).join(","),
      });
      const { status, body } = await call(`/live-data/ltp?${query}`, { token: auth.token });
      // A whole batch failing on NSE shouldn't lose the BSE attempt
      if (status !== 200) {
        if (exchange === "BSE" && Object.keys(prices).length === 0)
          return { ok: false, error: why(status, body) };
        continue;
      }
      const data = envelope(body);
      for (const symbol of batch) {
        const raw = data[`${exchange}_${symbol}`];
        const lastPrice = typeof raw === "object" && raw !== null ? num((raw as { ltp?: number }).ltp) : num(raw);
        if (lastPrice > 0) prices[symbol] = { lastPrice, dayChangePerc: null, exchange };
      }
    }
  }
  return { ok: true, prices };
}
