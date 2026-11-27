"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import Sheet from "@/components/ui/sheet";
import {
  Field,
  Figures,
  Rows,
  inputClass,
  primaryButtonClass,
  quietButtonClass,
  toneClass,
} from "@/components/ui/kit";
import { formatMoney, formatShortDate } from "@/lib/finance";
import {
  EXIT_REASONS,
  KINDS,
  groupTrades,
  holdingDays,
  isClosed,
  openCosts,
  plannedRisk,
  rMultiple,
  tradePnl,
  tradeStats,
  type ExitReason,
  type Trade,
  type TradeKind,
  type TradeSide,
} from "@/lib/trades";
import {
  closeTrade,
  deleteTrade,
  logTrade,
  tradeScreenshotUrl,
  updateTrade,
} from "@/app/(dashboard)/financial/savings/trades/actions";

const money = (n: number) => formatMoney(Math.round(n));
const signed = (n: number) => `${n < 0 ? "−" : "+"}${money(Math.abs(n))}`;
const tone = (n: number) => (n > 0 ? "good" : n < 0 ? "bad" : undefined);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE = 10 * 1024 * 1024;

type Editing = { mode: "log" } | { mode: "edit" | "close"; trade: Trade } | null;

export default function TradeJournal({
  trades,
  today,
  userId,
}: {
  trades: Trade[];
  today: string;
  userId: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const open = trades.filter((t) => !isClosed(t));
  const closed = trades.filter(isClosed);
  const stats = tradeStats(trades);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Figures
          className="flex-1"
          items={[
            {
              label: "Net, after charges",
              value: stats.closed ? signed(stats.net) : "—",
              hint: `${stats.closed} closed · ${stats.open} open`,
              tone: tone(stats.net),
            },
            {
              label: "Win rate",
              value: stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`,
              hint: stats.closed ? `${stats.wins} of ${stats.closed}` : "No closed trades yet",
            },
            {
              label: "Average trade",
              value: stats.expectancy === null ? "—" : signed(stats.expectancy),
              hint:
                stats.avgWin !== null && stats.avgLoss !== null
                  ? `wins ${money(stats.avgWin)} · losses ${money(stats.avgLoss)}`
                  : "Close a trade to see this",
              tone: stats.expectancy === null ? undefined : tone(stats.expectancy),
            },
            {
              label: "Average R",
              value: stats.avgR === null ? "—" : `${stats.avgR > 0 ? "+" : ""}${stats.avgR.toFixed(2)}R`,
              hint:
                stats.avgR === null
                  ? "Needs a stop on the trade"
                  : "Profit against the risk you set",
              tone: stats.avgR === null ? undefined : tone(stats.avgR),
            },
          ]}
        />
        <button type="button" onClick={() => setEditing({ mode: "log" })} className={quietButtonClass}>
          Log a trade
        </button>
      </div>

      {trades.length === 0 && (
        <p className="text-sm text-paper/70">
          Nothing logged yet. Record a trade as you take it — the entry, your stop, your
          target and why — and this page will tell you which of your setups actually pay.
        </p>
      )}

      {open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold tracking-tight text-2xl">Open</h2>
          <Rows>
            {open.map((t) => {
              const risk = plannedRisk(t);
              const days = holdingDays(t, today);
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {t.symbol}
                      <span className="ml-2 text-xs text-paper/60">
                        {t.side === "short" ? "short · " : ""}
                        {t.kind}
                        {t.setup ? ` · ${t.setup}` : ""}
                      </span>
                    </p>
                    <p className="truncate text-xs text-paper/65">
                      {t.quantity} × {formatMoney(t.entry_price)} ·{" "}
                      {days === 0 ? "opened today" : `${days} ${days === 1 ? "day" : "days"} in`}
                      {t.stop_price !== null && ` · stop ${formatMoney(t.stop_price)}`}
                      {t.target_price !== null && ` · target ${formatMoney(t.target_price)}`}
                      {t.stop_moves > 0 && ` · stop moved ${t.stop_moves}×`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums text-paper/78">
                      {risk === null ? "no stop set" : `risking ${money(risk)}`}
                    </p>
                    <div className="mt-0.5 flex justify-end gap-3 text-xs font-medium">
                      <button type="button" onClick={() => setEditing({ mode: "edit", trade: t })} className="text-paper/72">
                        Edit
                      </button>
                      <button type="button" onClick={() => setEditing({ mode: "close", trade: t })} className="text-ember">
                        Close
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </Rows>
          <p className="text-xs text-paper/55">
            Charges on the entries so far:{" "}
            {money(open.reduce((sum, t) => sum + openCosts(t), 0))}, estimated.
          </p>
        </section>
      )}

      {closed.length > 0 && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-bold tracking-tight text-2xl">Closed</h2>
            <Rows>
              {closed.map((t) => {
                const pnl = tradePnl(t)!;
                const r = rMultiple(t);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {t.symbol}
                        <span className="ml-2 text-xs text-paper/60">
                          {t.setup ?? t.kind}
                        </span>
                      </p>
                      <p className="truncate text-xs text-paper/65">
                        {formatShortDate(t.entry_on)} → {formatShortDate(t.exit_on!)} ·{" "}
                        {formatMoney(t.entry_price)} → {formatMoney(t.exit_price!)}
                        {t.exit_reason && ` · ${t.exit_reason}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold tabular-nums ${toneClass(tone(pnl.net))}`}>
                        {signed(pnl.net)}
                      </p>
                      <p className="text-xs tabular-nums text-paper/60">
                        {r === null ? "" : `${r > 0 ? "+" : ""}${r.toFixed(2)}R · `}
                        {pnl.estimated ? "charges est." : "actual charges"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </Rows>
          </section>

          <Breakdown trades={closed} />
        </>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing?.mode === "close"
            ? `Close ${editing.trade.symbol}`
            : editing?.mode === "edit"
              ? `Edit ${editing.trade.symbol}`
              : "Log a trade"
        }
      >
        {editing?.mode === "log" && (
          <LogForm userId={userId} today={today} onDone={() => setEditing(null)} />
        )}
        {editing?.mode === "edit" && (
          <EditForm trade={editing.trade} onDone={() => setEditing(null)} />
        )}
        {editing?.mode === "close" && (
          <CloseForm trade={editing.trade} today={today} onDone={() => setEditing(null)} />
        )}
      </Sheet>
    </div>
  );
}

// Which setups and which horizons pay, from the record rather than a guess
function Breakdown({ trades }: { trades: Trade[] }) {
  const [by, setBy] = useState<"setup" | "kind">("setup");
  const groups = groupTrades(trades, by);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold tracking-tight text-2xl">What works for you</h2>
        <div className="flex gap-3 text-xs font-medium">
          {(["setup", "kind"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBy(option)}
              aria-pressed={by === option}
              className={by === option ? "text-ember" : "text-paper/65"}
            >
              {option === "setup" ? "By setup" : "By horizon"}
            </button>
          ))}
        </div>
      </div>
      <Rows>
        {groups.map((group) => (
          <li key={group.name} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium capitalize">{group.name}</p>
              <p className="text-xs text-paper/65">
                {group.stats.closed} closed
                {group.stats.winRate !== null && ` · ${group.stats.winRate.toFixed(0)}% won`}
                {group.stats.avgR !== null &&
                  ` · ${group.stats.avgR > 0 ? "+" : ""}${group.stats.avgR.toFixed(2)}R average`}
              </p>
            </div>
            <p className={`shrink-0 font-semibold tabular-nums ${toneClass(tone(group.stats.net))}`}>
              {signed(group.stats.net)}
            </p>
          </li>
        ))}
      </Rows>
    </section>
  );
}

function Error({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-inset border border-paper/10 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 flex-1 rounded-lg text-sm font-medium transition ${
            value === option.value ? "bg-ember text-on-ember" : "text-paper/78 hover:bg-paper/5"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LogForm({
  userId,
  today,
  onDone,
}: {
  userId: string;
  today: string;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<TradeKind>("swing");
  const [side, setSide] = useState<TradeSide>("long");
  const [form, setForm] = useState({
    symbol: "",
    quantity: "",
    entry_price: "",
    entry_on: today,
    stop_price: "",
    target_price: "",
    setup: "",
    thesis: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      let path: string | null = null;
      if (file) {
        // Straight to storage, as documents do, then the path is recorded
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        path = `${userId}/trades/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await createClient()
          .storage.from("documents")
          .upload(path, file, { contentType: file.type });
        if (uploadError) {
          setError(`Couldn't upload the screenshot: ${uploadError.message}`);
          return;
        }
      }
      const result = await logTrade({
        ...form,
        kind,
        side,
        stop_price: form.stop_price || null,
        target_price: form.target_price || null,
        setup: form.setup || null,
        thesis: form.thesis || null,
        screenshot_path: path,
      });
      if (result.ok) onDone();
      else setError(result.error);
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        options={KINDS.map((k) => ({ value: k.kind, label: k.label }))}
        value={kind}
        onChange={setKind}
      />
      <Segmented
        options={[
          { value: "long" as TradeSide, label: "Long" },
          { value: "short" as TradeSide, label: "Short" },
        ]}
        value={side}
        onChange={setSide}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stock">
          <input
            value={form.symbol}
            onChange={(e) => set({ symbol: e.target.value })}
            placeholder="TATAMOTORS"
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Shares">
          <input
            inputMode="decimal"
            value={form.quantity}
            onChange={(e) => set({ quantity: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Entry price">
          <input
            inputMode="decimal"
            value={form.entry_price}
            onChange={(e) => set({ entry_price: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Entry date">
          <input
            type="date"
            value={form.entry_on}
            max={today}
            onChange={(e) => set({ entry_on: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Your stop" hint="Sets the risk">
          <input
            inputMode="decimal"
            value={form.stop_price}
            onChange={(e) => set({ stop_price: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Your target">
          <input
            inputMode="decimal"
            value={form.target_price}
            onChange={(e) => set({ target_price: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Setup" hint="Your own name for it">
        <input
          value={form.setup}
          onChange={(e) => set({ setup: e.target.value })}
          placeholder="Breakout, pullback, earnings…"
          className={inputClass}
        />
      </Field>
      <Field label="Why are you taking it?">
        <textarea
          value={form.thesis}
          onChange={(e) => set({ thesis: e.target.value })}
          rows={3}
          placeholder="What you saw, in your words. Worth reading back later."
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Field label="Chart screenshot" hint="Optional, up to 10 MB">
        <input
          type="file"
          accept={IMAGE_TYPES.join(",")}
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            if (picked && !IMAGE_TYPES.includes(picked.type))
              return setError("Screenshots can be JPEG, PNG, WebP or HEIC.");
            if (picked && picked.size > MAX_IMAGE) return setError("That image is over 10 MB.");
            setError(null);
            setFile(picked);
          }}
          className="text-sm text-paper/72"
        />
      </Field>
      <Error message={error} />
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={quietButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} flex-1`}>
          {pending ? "Saving…" : "Log it"}
        </button>
      </div>
    </form>
  );
}

function EditForm({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const [stop, setStop] = useState(trade.stop_price?.toString() ?? "");
  const [target, setTarget] = useState(trade.target_price?.toString() ?? "");
  const [setup, setSetup] = useState(trade.setup ?? "");
  const [thesis, setThesis] = useState(trade.thesis ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const movingStop = stop !== (trade.stop_price?.toString() ?? "") && trade.stop_price !== null;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await updateTrade(trade.id, {
            stop_price: stop || null,
            target_price: target || null,
            setup: setup || null,
            thesis: thesis || null,
          });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your stop">
          <input inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Your target">
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {movingStop && (
        <p className="text-xs text-paper/60">
          Moving the stop is recorded — it&apos;s been moved {trade.stop_moves}× so far.
        </p>
      )}
      <Field label="Setup">
        <input value={setup} onChange={(e) => setSetup(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Why you took it">
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      {trade.screenshot_path && (
        <button
          type="button"
          onClick={async () => setScreenshot(await tradeScreenshotUrl(trade.screenshot_path!))}
          className="self-start text-sm font-medium text-ember"
        >
          {screenshot ? "Opened below" : "Show the chart screenshot"}
        </button>
      )}
      {screenshot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={screenshot} alt={`Chart for ${trade.symbol}`} className="rounded-inset" />
      )}

      <Error message={error} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete the ${trade.symbol} trade?`)) return;
            startTransition(async () => {
              const result = await deleteTrade(trade.id);
              if (result.ok) onDone();
              else setError(result.error);
            });
          }}
          className={`${quietButtonClass} text-red-700 dark:text-red-300`}
        >
          Delete
        </button>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} flex-1`}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function CloseForm({
  trade,
  today,
  onDone,
}: {
  trade: Trade;
  today: string;
  onDone: () => void;
}) {
  const [price, setPrice] = useState("");
  const [on, setOn] = useState(today);
  const [reason, setReason] = useState<ExitReason>("target");
  const [review, setReview] = useState("");
  const [costs, setCosts] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // What this exit would come to, worked out as it's typed
  const preview = (() => {
    const exit = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(exit) || exit <= 0) return null;
    return tradePnl({ ...trade, exit_price: exit, exit_on: on, costs: costs ? Number(costs) : null });
  })();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await closeTrade(trade.id, {
            exit_price: price,
            exit_on: on,
            exit_reason: reason,
            review: review || null,
            costs: costs || null,
          });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
    >
      <p className="text-sm text-paper/70">
        {trade.quantity} × {formatMoney(trade.entry_price)} in on {formatShortDate(trade.entry_on)}
        {trade.stop_price !== null && `, stop ${formatMoney(trade.stop_price)}`}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Exit price">
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Exit date">
          <input
            type="date"
            value={on}
            max={today}
            min={trade.entry_on}
            onChange={(e) => setOn(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Segmented
        options={EXIT_REASONS.map((r) => ({ value: r.reason, label: r.label }))}
        value={reason}
        onChange={setReason}
      />
      <Field label="Charges actually paid" hint="Optional — otherwise estimated">
        <input inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Looking back, what happened?">
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          rows={3}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      {preview && (
        <p className="text-sm">
          <span className={toneClass(tone(preview.net))}>{signed(preview.net)}</span>{" "}
          <span className="text-paper/60">
            after {money(preview.costs)} charges
            {preview.estimated ? " (estimated)" : ""}
          </span>
        </p>
      )}
      <Error message={error} />
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={quietButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} flex-1`}>
          {pending ? "Saving…" : "Close the trade"}
        </button>
      </div>
    </form>
  );
}
