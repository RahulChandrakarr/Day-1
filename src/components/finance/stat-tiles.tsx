import { toneClass } from "@/components/ui/kit";
import { formatMoney, type Totals } from "@/lib/finance";

type Tile = { label: string; value: string; hint?: string; tone?: "good" | "bad" };

// Phones use a 6-column grid: three tiles sit three across, four make a
// 2x2, and five go three then two wider. Wider screens: one row.
const phoneSpan = (count: number, i: number) =>
  count === 3 || count === 6 || (count === 5 && i < 3) ? "col-span-2" : "col-span-3";
const wideCols: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

// Income / expenses / net, plus anything a page adds, each in its own card.
export default function StatTiles({
  totals,
  extra = [],
  netHint,
  incomeHint,
  expenseHint,
  balance = null,
}: {
  totals: Totals;
  extra?: Tile[];
  netHint?: string;
  // What the plan expected, when the period has one
  incomeHint?: string;
  expenseHint?: string;
  // What is in the bank accounts, when the user has added any
  balance?: { total: number; hint: string } | null;
}) {
  const net = balance?.total ?? totals.net;
  const tiles: Tile[] = [
    { label: "Income", value: formatMoney(totals.income), hint: incomeHint, tone: "good" },
    { label: "Expenses", value: formatMoney(totals.expense), hint: expenseHint },
    {
      label: "Net balance",
      value: `${net < 0 ? "−" : ""}${formatMoney(Math.abs(net))}`,
      hint: balance?.hint ?? netHint ?? (totals.net >= 0 ? "Saved" : "Overspent"),
      tone: net < 0 ? "bad" : "good",
    },
    ...extra,
  ];

  return (
    <div className={`grid grid-cols-6 gap-2 sm:gap-3 ${wideCols[tiles.length] ?? "sm:grid-cols-4"}`}>
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          title={tile.hint ? `${tile.label}: ${tile.value} · ${tile.hint}` : `${tile.label}: ${tile.value}`}
          className={`min-w-0 card p-3 sm:col-span-1 ${phoneSpan(tiles.length, i)}`}
        >
          <p className="truncate text-[11px] text-paper/55 sm:text-xs">{tile.label}</p>
          <p
            // Lakh-sized amounts step down a size to fit three across on phones
            className={`mt-0.5 truncate font-bold tabular-nums sm:text-[19px] ${
              tile.value.length > 8 ? "text-[13px]" : "text-base"
            } ${toneClass(tile.tone)}`}
          >
            {tile.value}
          </p>
          {tile.hint && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-paper/40 sm:text-xs">{tile.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export { toneClass };
