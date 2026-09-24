import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchHoldings, fetchPrices, growwConfigured, NO_MARKET_DATA } from "@/lib/groww";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result = { ok: true } | { ok: false; error: string };

// Pulls the demat holdings from Groww and replaces the stored ones. The rows
// are a mirror, so anything sold no longer appears. A failure is written to
// finance_portfolio_sync too, so the page can say why the numbers are old.
export async function syncPortfolio(
  client?: Supabase,
): Promise<Result & { holdings?: number; unpriced?: number; pricesOk?: boolean }> {
  const supabase = client ?? (await createClient());
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, error: "Not signed in." };

  if (!growwConfigured())
    return {
      ok: false,
      error: "Groww isn't connected. Add GROWW_API_KEY and GROWW_API_SECRET on the server.",
    };

  const note = async (status: "ok" | "failed", message: string | null, holdings: number) => {
    await supabase.from("finance_portfolio_sync").upsert(
      {
        user_id: userId,
        synced_at: status === "ok" ? new Date().toISOString() : undefined,
        status,
        message: message?.slice(0, 300) ?? null,
        holdings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  };

  // What we knew before, so a quantity going up can be recorded as a purchase
  const { data: before } = await supabase
    .from("finance_holdings")
    .select("symbol, quantity")
    .returns<{ symbol: string; quantity: number | string }[]>();
  const wasHeld = new Map((before ?? []).map((r) => [r.symbol, Number(r.quantity)]));

  const fetched = await fetchHoldings();
  if (!fetched.ok) {
    await note("failed", fetched.error, 0);
    return { ok: false, error: fetched.error };
  }

  const priced = await fetchPrices(fetched.holdings.map((h) => h.symbol));
  // Prices are a bonus: without them the holdings are still worth storing
  const prices = priced.ok ? priced.prices : {};

  const now = new Date().toISOString();
  const rows = fetched.holdings.map((h) => {
    const price = prices[h.symbol];
    return {
      user_id: userId,
      isin: h.isin,
      symbol: h.symbol,
      exchange: price?.exchange ?? "NSE",
      quantity: h.quantity,
      average_price: h.averagePrice,
      last_price: price?.lastPrice ?? null,
      day_change_perc: price?.dayChangePerc ?? null,
      priced_at: price ? now : null,
      updated_at: now,
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("finance_holdings")
      .upsert(rows, { onConflict: "user_id,symbol" });
    if (error) {
      await note("failed", error.message, 0);
      return { ok: false, error: error.message };
    }
  }

  // Whatever is no longer held has been sold
  const held = rows.map((r) => r.symbol);
  const stale = supabase.from("finance_holdings").delete().eq("user_id", userId);
  const { error: deleteError } = await (held.length
    ? stale.not("symbol", "in", `(${held.map((s) => `"${s}"`).join(",")})`)
    : stale);
  if (deleteError) {
    await note("failed", deleteError.message, rows.length);
    return { ok: false, error: deleteError.message };
  }

  // A symbol we already knew, now with more shares, was bought today. A symbol
  // appearing for the first time could have been bought years ago, so it gets
  // no lot and the user enters its date.
  const bought = fetched.holdings
    .filter((h) => wasHeld.has(h.symbol) && h.quantity > (wasHeld.get(h.symbol) ?? 0))
    .map((h) => ({
      user_id: userId,
      symbol: h.symbol,
      quantity: h.quantity - (wasHeld.get(h.symbol) ?? 0),
      price: prices[h.symbol]?.lastPrice ?? h.averagePrice,
      bought_on: now.slice(0, 10),
      estimated: true,
    }));
  if (bought.length > 0) await supabase.from("finance_holding_lots").insert(bought);

  const unpriced = rows.filter((r) => r.last_price === null).length;
  await note(
    "ok",
    priced.ok
      ? null
      : priced.error === NO_MARKET_DATA
        ? NO_MARKET_DATA
        : "Holdings updated, but live prices didn't come through.",
    rows.length,
  );
  return { ok: true, holdings: rows.length, unpriced, pricesOk: priced.ok };
}
