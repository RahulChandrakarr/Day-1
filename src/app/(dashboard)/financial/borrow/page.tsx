import Link from "next/link";
import PeopleList, {
  type PersonPlan,
} from "@/components/finance/borrow/people-list";
import { personBalances } from "@/lib/debts";
import {
  budgetReport,
  formatMoney,
  formatMonth,
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
      hint: owed >= owe ? "More coming back than going out" : "You owe more than you're owed",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`rounded-[18px] border border-paper/10 bg-surface p-4 ${
              i === 2 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <p className="flex items-center gap-2 text-sm text-paper/55">
              {tile.swatch && (
                <span className={`h-2.5 w-2.5 rounded-sm ${tile.swatch}`} />
              )}
              {tile.label}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl xl:text-3xl">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-paper/45">{tile.hint}</p>
          </div>
        ))}
      </div>

      <p className="-mt-2 text-sm text-paper/45">
        Log borrowing with Add entry above. It isn&apos;t counted as income or
        expenses. Plan what to return or collect in the{" "}
        <Link href="/financial/monthly" className="text-ember hover:underline">
          {formatMonth(month)} plan
        </Link>
        .
      </p>

      <PeopleList
        people={balances}
        plans={plans}
        monthLabel={formatMonthShort(month)}
      />
    </div>
  );
}
