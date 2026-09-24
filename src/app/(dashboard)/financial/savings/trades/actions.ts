"use server";

import { isValidDate, todayISO } from "@/lib/finance";
import type { ExitReason, TradeKind, TradeSide } from "@/lib/trades";
import { authedClient, parseAmount, refresh, uuid } from "../../action-utils";

type Result = { ok: true; id?: string } | { ok: false; error: string };

const KINDS: TradeKind[] = ["intraday", "swing", "investment"];
const SIDES: TradeSide[] = ["long", "short"];
const REASONS: ExitReason[] = ["target", "stop", "manual", "other"];

const text = (value: string | null | undefined, max: number) => {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

// A price the user may leave empty
function optionalPrice(raw: string | null | undefined, label: string) {
  if (!raw?.trim()) return { value: null as number | null, error: null as string | null };
  const value = parseAmount(raw);
  return value === null
    ? { value: null, error: `That ${label} isn't a number.` }
    : { value, error: null };
}

async function ownUserId() {
  const supabase = await authedClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub as string | undefined };
}

export async function logTrade(input: {
  symbol: string;
  kind: TradeKind;
  side: TradeSide;
  quantity: string;
  entry_price: string;
  entry_on: string;
  stop_price: string | null;
  target_price: string | null;
  setup: string | null;
  thesis: string | null;
  screenshot_path: string | null;
}): Promise<Result> {
  const symbol = text(input.symbol, 40)?.toUpperCase();
  if (!symbol) return { ok: false, error: "Which stock was it?" };
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick intraday, swing or investment." };
  if (!SIDES.includes(input.side)) return { ok: false, error: "Pick long or short." };

  const quantity = parseAmount(input.quantity);
  if (quantity === null || quantity <= 0) return { ok: false, error: "How many shares?" };
  const entry = parseAmount(input.entry_price);
  if (entry === null || entry <= 0) return { ok: false, error: "What price did you get in at?" };
  if (!isValidDate(input.entry_on)) return { ok: false, error: "Pick a valid entry date." };
  if (input.entry_on > todayISO())
    return { ok: false, error: "The entry date can't be in the future." };

  const stop = optionalPrice(input.stop_price, "stop");
  if (stop.error) return { ok: false, error: stop.error };
  const target = optionalPrice(input.target_price, "target");
  if (target.error) return { ok: false, error: target.error };

  const { supabase, userId } = await ownUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  if (input.screenshot_path && !input.screenshot_path.startsWith(`${userId}/`))
    return { ok: false, error: "That screenshot doesn't belong to this account." };

  const { data, error } = await supabase
    .from("finance_trades")
    .insert({
      symbol,
      kind: input.kind,
      side: input.side,
      quantity,
      entry_price: entry,
      entry_on: input.entry_on,
      stop_price: stop.value,
      target_price: target.value,
      setup: text(input.setup, 40),
      thesis: text(input.thesis, 1000),
      screenshot_path: input.screenshot_path,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id: data.id };
}

// Editing an open trade. Moving the stop after entry is counted, because that
// habit is worth being able to see.
export async function updateTrade(
  id: string,
  input: {
    stop_price: string | null;
    target_price: string | null;
    setup: string | null;
    thesis: string | null;
  },
): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown trade." };
  const stop = optionalPrice(input.stop_price, "stop");
  if (stop.error) return { ok: false, error: stop.error };
  const target = optionalPrice(input.target_price, "target");
  if (target.error) return { ok: false, error: target.error };

  const supabase = await authedClient();
  const { data: before, error: readError } = await supabase
    .from("finance_trades")
    .select("stop_price, exit_price, stop_moves")
    .eq("id", id)
    .maybeSingle<{
      stop_price: number | string | null;
      exit_price: number | string | null;
      stop_moves: number;
    }>();
  if (readError) return { ok: false, error: readError.message };
  if (!before) return { ok: false, error: "That trade is gone." };

  const was = before.stop_price === null ? null : Number(before.stop_price);
  const moved = before.exit_price === null && was !== null && stop.value !== was;

  const { error } = await supabase
    .from("finance_trades")
    .update({
      stop_price: stop.value,
      target_price: target.value,
      setup: text(input.setup, 40),
      thesis: text(input.thesis, 1000),
      stop_moves: moved ? before.stop_moves + 1 : before.stop_moves,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function closeTrade(
  id: string,
  input: {
    exit_price: string;
    exit_on: string;
    exit_reason: ExitReason;
    review: string | null;
    costs: string | null;
  },
): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown trade." };
  const exit = parseAmount(input.exit_price);
  if (exit === null || exit <= 0) return { ok: false, error: "What price did you get out at?" };
  if (!isValidDate(input.exit_on)) return { ok: false, error: "Pick a valid exit date." };
  if (input.exit_on > todayISO())
    return { ok: false, error: "The exit date can't be in the future." };
  if (!REASONS.includes(input.exit_reason)) return { ok: false, error: "How did it end?" };
  const costs = optionalPrice(input.costs, "cost");
  if (costs.error) return { ok: false, error: costs.error };

  const supabase = await authedClient();
  const { data: before } = await supabase
    .from("finance_trades")
    .select("entry_on")
    .eq("id", id)
    .maybeSingle<{ entry_on: string }>();
  if (before && input.exit_on < before.entry_on)
    return { ok: false, error: "The exit can't be before the entry." };

  const { error } = await supabase
    .from("finance_trades")
    .update({
      exit_price: exit,
      exit_on: input.exit_on,
      exit_reason: input.exit_reason,
      review: text(input.review, 1000),
      costs: costs.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteTrade(id: string): Promise<Result> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown trade." };
  const supabase = await authedClient();
  const { data: trade } = await supabase
    .from("finance_trades")
    .select("screenshot_path")
    .eq("id", id)
    .maybeSingle<{ screenshot_path: string | null }>();
  const { error } = await supabase.from("finance_trades").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  // The image is no use without the trade
  if (trade?.screenshot_path)
    await supabase.storage.from("documents").remove([trade.screenshot_path]);
  refresh();
  return { ok: true };
}

// A short-lived link to a screenshot, as the documents feature serves files
export async function tradeScreenshotUrl(path: string): Promise<string | null> {
  const { supabase, userId } = await ownUserId();
  if (!userId || !path.startsWith(`${userId}/`)) return null;
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}
