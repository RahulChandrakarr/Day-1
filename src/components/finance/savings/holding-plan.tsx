"use client";

import { useState, useTransition } from "react";
import { saveHoldingPlan } from "@/app/(dashboard)/financial/savings/actions";
import { formatMoney } from "@/lib/finance";
import {
  holdingTiming,
  swingView,
  type Holding,
  type HoldingMode,
  type Lot,
} from "@/lib/portfolio";
import { Field, inputClass, quietButtonClass } from "@/components/ui/kit";

const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%`;

// The one line under a holding: what its mode means for it right now
export function PlanLine({
  holding,
  lots,
  today,
}: {
  holding: Holding;
  lots: Lot[];
  today: string;
}) {
  if (holding.mode === "swing") {
    const view = swingView(holding);
    const parts = [
      view?.target && `target ${formatMoney(view.target.level)} (${pct(view.target.awayPct)})`,
      view?.stop && `stop ${formatMoney(view.stop.level)} (${pct(view.stop.awayPct)})`,
    ].filter(Boolean);
    return (
      <span className="text-xs text-paper/45">
        {parts.length ? parts.join(" · ") : "Swing — set a target and a stop"}
      </span>
    );
  }

  const timing = holdingTiming(holding, lots, today);
  if (!timing) return <span className="text-xs text-paper/45">Add the buy date for tax timing</span>;
  if (timing.allLongTerm)
    return (
      <span className="text-xs text-moss">
        Long term · held {Math.floor(timing.daysHeld / 365)}y {timing.daysHeld % 365}d
      </span>
    );
  if (!timing.next)
    return <span className="text-xs text-paper/45">Held {timing.daysHeld} days</span>;
  return (
    <span className="text-xs text-paper/60">
      {timing.next.daysToLongTerm} days to long term
      {timing.saving > 0 && ` · waiting saves ${formatMoney(timing.saving)} tax`}
    </span>
  );
}

// Their own plan for the holding: how they're holding it, when they bought,
// and the two prices they decided on. Nothing here is a recommendation.
export function PlanForm({
  holding,
  onDone,
}: {
  holding: Holding;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<HoldingMode>(holding.mode);
  const [boughtOn, setBoughtOn] = useState(holding.bought_on ?? "");
  const [target, setTarget] = useState(holding.target_price?.toString() ?? "");
  const [stop, setStop] = useState(holding.stop_price?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 flex flex-col gap-3 border-t border-paper/[0.06] pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveHoldingPlan({
            id: holding.id,
            mode,
            bought_on: boughtOn || null,
            target_price: target || null,
            stop_price: stop || null,
          });
          if (result.ok) onDone();
          else setError(result.error ?? "Couldn't save.");
        });
      }}
    >
      <div className="flex gap-1 rounded-inset border border-paper/10 p-1">
        {(
          [
            ["long_term", "Long term"],
            ["swing", "Swing"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`min-h-9 flex-1 rounded-lg text-sm font-medium transition ${
              mode === value ? "bg-ember text-on-ember" : "text-paper/70 hover:bg-paper/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Field label="Bought on" hint="Sets the tax clock">
        <input
          type="date"
          value={boughtOn}
          max={today()}
          onChange={(e) => setBoughtOn(e.target.value)}
          className={inputClass}
        />
      </Field>

      {mode === "swing" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your target">
            <input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Price you'd sell at"
              className={inputClass}
            />
          </Field>
          <Field label="Your stop">
            <input
              inputMode="decimal"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              placeholder="Price you'd cut at"
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={quietButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={`${quietButtonClass} flex-1`}>
          {pending ? "Saving…" : "Save plan"}
        </button>
      </div>
    </form>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
