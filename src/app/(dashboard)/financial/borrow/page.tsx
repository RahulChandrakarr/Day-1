import { Suspense } from "react";
import PeopleList, {
  type PersonPlan,
} from "@/components/finance/borrow/people-list";
import { personBalances } from "@/lib/debts";
import {
  budgetReport,
  formatMoney,
  formatMonthShort,
  monthRange,
  todayISO,
} from "@/lib/finance";
import {
  getBudget,
  getDebts,
  getPeople,
  getTransactions,
} from "@/lib/finance-queries";
import SplitwiseBalances from "@/components/finance/borrow/splitwise-balances";
import { Skeleton, Stack } from "@/components/ui/kit";

export default async function BorrowPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const range = monthRange(month);

  const [people, debts, budget] = await Promise.all([
    getPeople(),
    getDebts(),
    getBudget("month", month),
  ]);
  const balances = personBalances(people, debts);
  const owe = balances.reduce((s, p) => s + p.owe, 0);
  const owed = balances.reduce((s, p) => s + p.owed, 0);

  // This month's return/collect plan per person
  const plans: Record<string, PersonPlan> = {};
  if (budget?.lines.some((l) => l.kind !== "spend")) {
    const report = budgetReport(budget, "month", month, {
      transactions: await getTransactions(range),
      debts: debts.filter(
        (d) => d.occurred_on >= range.from && d.occurred_on <= range.to,
      ),
    });
    for (const row of report.repay)
      plans[row.id] = { ...(plans[row.id] ?? { collect: null }), repay: row };
    for (const row of report.collect)
      plans[row.id] = { ...(plans[row.id] ?? { repay: null }), collect: row };
  }

  const tiles = [
    {
      label: "You owe",
      value: formatMoney(owe),
      hint: `${balances.filter((p) => p.owe > 0).length} people to pay back`,
      swatch: "bg-chart-expense",
    },
    {
      label: "Owed to you",
      value: formatMoney(owed),
      hint: `${balances.filter((p) => p.owed > 0).length} people to collect from`,
      swatch: "bg-chart-income",
    },
    {
      label: "Net",
      value: `${owed - owe < 0 ? "−" : ""}${formatMoney(Math.abs(owed - owe))}`,
    },
  ];

  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`card p-4 ${
              i === 2 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <p className="flex items-center gap-2 text-sm text-paper/70">
              {tile.swatch && (
                <span className={`h-2.5 w-2.5 rounded-sm ${tile.swatch}`} />
              )}
              {tile.label}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl xl:text-3xl">
              {tile.value}
            </p>
            {tile.hint && <p className="mt-1 text-xs text-paper/60">{tile.hint}</p>}
          </div>
        ))}
      </div>

      <PeopleList
        people={balances}
        plans={plans}
        monthLabel={formatMonthShort(month)}
      />

      {/* Read live from Splitwise; the page above doesn't wait for it */}
      <Suspense fallback={<Skeleton className="h-40" />}>
        <SplitwiseBalances />
      </Suspense>
    </Stack>
  );
}
