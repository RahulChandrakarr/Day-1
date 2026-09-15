import { formatMoney, type Totals } from "@/lib/finance";

type Tile = { label: string; value: string; hint?: string };

export default function StatTiles({
  totals,
  extra = [],
}: {
  totals: Totals;
  extra?: Tile[];
}) {
  const tiles: (Tile & { swatch?: string })[] = [
    {
      label: "Income",
      value: formatMoney(totals.income),
      swatch: "bg-chart-income",
    },
    {
      label: "Expenses",
      value: formatMoney(totals.expense),
      swatch: "bg-chart-expense",
    },
    {
      label: "Net balance",
      value: `${totals.net < 0 ? "−" : ""}${formatMoney(Math.abs(totals.net))}`,
      hint: totals.net >= 0 ? "Saved" : "Overspent",
    },
    ...extra,
  ];

  return (
    <div
      className={`grid grid-cols-2 gap-3 ${
        tiles.length > 3 ? "lg:grid-cols-4" : "sm:grid-cols-3"
      }`}
    >
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className={`rounded-2xl border border-paper/10 bg-surface/60 p-4 sm:p-5 ${
            tiles.length === 3 && i === 2 ? "col-span-2 sm:col-span-1" : ""
          }`}
        >
          <p className="flex items-center gap-2 text-sm text-paper/55">
            {tile.swatch && (
              <span className={`h-2.5 w-2.5 rounded-sm ${tile.swatch}`} />
            )}
            {tile.label}
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl xl:text-3xl">
            {tile.value}
          </p>
          {tile.hint && (
            <p className="mt-1 text-xs text-paper/45">{tile.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
