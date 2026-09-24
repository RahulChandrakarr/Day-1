import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchHoldings, fetchPrices, growwConfigured } from "@/lib/groww";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result = { ok: true } | { ok: false; error: string };

// Pulls the demat holdings from Groww and replaces the stored ones. The rows
// are a mirror, so anything sold no longer appears. A failure is written to
// finance_portfolio_sync too, so the page can say why the numbers are old.
export async function syncPortfolio(
  client?: Supabase,
): Promise<Result & { holdings?: number; unpriced?: number }> {
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

  const unpriced = rows.filter((r) => r.last_price === null).length;
  await note(
    "ok",
    unpriced > 0 && !priced.ok ? "Holdings updated, but live prices didn't come through." : null,
    rows.length,
  );
  return { ok: true, holdings: rows.length, unpriced };
}
