"use client";

import { useState, useTransition } from "react";
import { refreshPortfolio } from "@/app/(dashboard)/financial/savings/actions";
import { formatMoney } from "@/lib/finance";
import { exemptionView, holdingLots, lotTiming, type HoldingSummary, type Lot } from "@/lib/portfolio";
import { PlanForm, PlanLine } from "@/components/finance/savings/holding-plan";
import { Card, CardHead, Empty } from "@/components/ui/kit";

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n))}`;
const tone = (n: number) =>
  n > 0 ? "text-moss" : n < 0 ? "text-red-700 dark:text-red-300" : "text-paper/60";

export default function HoldingsCard({
  holdings,
  lots,
  today,
  syncedLabel,
  status,
  message,
  connected,
}: {
  holdings: HoldingSummary[];
  lots: Lot[];
  today: string;
  // "12 min ago", worked out on the server so it can't drift at hydration
  syncedLabel: string | null;
  status: "ok" | "failed" | null;
  message: string | null;
  connected: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  // Long-term gains above ₹1.25 lakh in a year stop being exempt, so it is
  // worth knowing how close the year is to that line
  const exemption = exemptionView(
    holdings.flatMap((h) =>
      holdingLots(h, lots).map((l) => lotTiming(l, h.last_price, today)),
    ),
    today,
  );
  const when = syncedLabel;

  // The stored message explains a failed sync until a new one replaces it
  const note = result ?? (status === "failed" && message ? { ok: false, message } : null);

  return (
    <Card>
      <CardHead
        title="Stocks"
        aside={when ? `Prices ${when}` : connected ? "Never synced" : undefined}
      />
      {connected && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setResult(null);
            startTransition(async () => setResult(await refreshPortfolio()));
          }}
          className="mb-3 min-h-9 self-start rounded-xl border border-paper/12 px-3 text-sm font-medium text-paper/80 hover:bg-paper/5 disabled:opacity-50"
        >
          {pending ? "Fetching from Groww…" : "Refresh prices"}
        </button>
      )}
      {note && (
        <p
          role={note.ok ? "status" : "alert"}
          className={`mb-3 text-sm ${note.ok ? "text-paper/60" : "text-red-700 dark:text-red-300"}`}
        >
          {note.message}
        </p>
      )}

      {!connected ? (
        <Empty>
          Groww isn&apos;t connected. Add the API key and TOTP secret on the server to pull your
          stocks in automatically.
        </Empty>
      ) : holdings.length === 0 ? (
        <Empty>
          No stocks yet. Press refresh to fetch your demat holdings from Groww.
        </Empty>
      ) : (
        <ul className="divide-y divide-paper/[0.06]">
          {holdings.map((h) => (
            <li key={h.id} className="py-2.5">
              <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {h.name?.trim() || h.symbol}
                  {h.mode === "swing" && (
                    <span className="ml-2 rounded-full bg-paper/[0.06] px-2 py-0.5 text-[11px] font-semibold text-paper/60">
                      swing
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-paper/50">
                  {h.quantity % 1 === 0 ? h.quantity : h.quantity.toFixed(2)} ×{" "}
                  {formatMoney(h.average_price)}
                  {h.last_price === null ? " · no live price" : ` · now ${formatMoney(h.last_price)}`}
                </p>
                <PlanLine holding={h} lots={lots} today={today} />
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{formatMoney(h.worth)}</p>
                {h.last_price === null ? (
                  // No price means this is just what it cost, not a gain of zero
                  <p className="text-xs text-paper/45">at cost</p>
                ) : (
                  <p className={`text-xs tabular-nums ${tone(h.gain)}`}>
                    {signed(h.gain)}
                    {h.gainPct !== null && ` · ${h.gain < 0 ? "−" : "+"}${Math.abs(h.gainPct).toFixed(1)}%`}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(editing === h.id ? null : h.id)}
                  className="mt-0.5 text-xs font-medium text-ember"
                >
                  {editing === h.id ? "Close" : "Plan"}
                </button>
              </div>
              </div>
              {editing === h.id && <PlanForm holding={h} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      )}
      {holdings.length > 0 && exemption.longTermGain > 0 && (
        <p className="mt-3 border-t border-paper/[0.06] pt-3 text-xs text-paper/45">
          {exemption.overExemption
            ? `Unrealised long-term gains are ${formatMoney(exemption.longTermGain)} — past the ₹1.25 lakh that's exempt in ${exemption.year}.`
            : `${formatMoney(exemption.headroom)} of the ₹1.25 lakh long-term exemption is unused in ${exemption.year}.`}{" "}
          Estimates at 20% short term and 12.5% long term, before costs.
        </p>
      )}
    </Card>
  );
}
