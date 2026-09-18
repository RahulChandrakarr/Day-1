import { Card, Figure, toneClass } from "@/components/ui/kit";
import { formatMoney, type Totals } from "@/lib/finance";

type Tile = { label: string; value: string; hint?: string };

// Income / expenses / net, plus anything a page adds.
export default function StatTiles({
  totals,
  extra = [],
  netHint,
  incomeHint,
  expenseHint,
}: {
  totals: Totals;
  extra?: Tile[];
  netHint?: string;
  // What the plan expected, when the period has one
  incomeHint?: string;
  expenseHint?: string;
}) {
  const tiles = [
    {
      label: "Income",
      value: formatMoney(totals.income),
      hint: incomeHint,
      tone: "good" as const,
    },
    { label: "Expenses", value: formatMoney(totals.expense), hint: expenseHint },
    {
      label: "Net balance",
      value: `${totals.net < 0 ? "−" : ""}${formatMoney(Math.abs(totals.net))}`,
      hint: netHint ?? (totals.net >= 0 ? "Saved" : "Overspent"),
      tone: totals.net < 0 ? ("bad" as const) : ("good" as const),
    },
    ...extra,
  ];

  return (
    <Card padded={false} className="px-4 py-1">
      <div
        className={`grid grid-cols-2 ${
          tiles.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"
        }`}
      >
        {tiles.map((tile, i) => (
          <Figure
            key={tile.label}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            tone={"tone" in tile ? tile.tone : undefined}
            divide={i < tiles.length - (tiles.length % 2 === 1 ? 1 : 2) && "mobile"}
          />
        ))}
      </div>
    </Card>
  );
}

export { toneClass };
