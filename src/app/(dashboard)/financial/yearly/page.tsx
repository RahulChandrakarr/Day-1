import Link from "next/link";
import BudgetCard from "@/components/finance/budget/budget-card";
import CategoryManager from "@/components/finance/category-manager";
import { BucketTable, IncomeExpenseChart } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionList from "@/components/finance/transaction-list";
import {
  budgetReport,
  formatMoney,
  monthBuckets,
  parseYearParam,
  todayISO,
  totalsOf,
  yearRange,
  type Budget,
  type Bucket,
} from "@/lib/finance";
import { personBalances } from "@/lib/debts";
import { netSaved, type InvestmentEntry } from "@/lib/investments";
import {
  getBudget,
  getCategories,
  getDebts,
  getInvestmentEntries,
  getMonthBudgets,
  getPeople,
  getPreviousBudget,
  getTransactions,
} from "@/lib/finance-queries";

export default async function YearlyFinancePage({
  searchParams,
}: PageProps<"/financial/yearly">) {
  const year = parseYearParam((await searchParams).year);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const { from, to } = yearRange(year);
  const key = String(year);

  const [
    transactions,
    categories,
    budget,
    previous,
    monthBudgets,
    people,
    debts,
    investments,
  ] = await Promise.all([
    getTransactions({ from, to }),
    getCategories(),
    getBudget("year", key),
    getPreviousBudget("year", key),
    getMonthBudgets(year),
    getPeople(),
    getDebts(),
    getInvestmentEntries({ from, to }),
  ]);
  const yearlyEntries = transactions.filter((t) => t.period === "yearly");
  const buckets = monthBuckets(year, transactions);
  const report = budget
    ? budgetReport(
        budget,
        "year",
        key,
        {
          transactions,
          debts: debts.filter((d) => d.occurred_on >= from && d.occurred_on <= to),
          investments,
        },
        today,
      )
    : null;
  // The plan's targets sit with the actuals up top, so the numbers appear once
  const savingsTile = report
    ? [
        {
          label: "Put into savings",
          value: `${report.savings.actual < 0 ? "−" : ""}${formatMoney(Math.abs(report.savings.actual))}`,
          hint:
            report.savings.target !== null
              ? `of ${formatMoney(report.savings.target)} target`
              : "No target set",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PeriodNav
        label={key}
        prevHref={`/financial/yearly?year=${year - 1}`}
        nextHref={`/financial/yearly?year=${year + 1}`}
        currentHref="/financial/yearly"
        isCurrent={year === thisYear}
        currentLabel="This year"
      />

      <StatTiles
        totals={totalsOf(transactions)}
        incomeHint={
          report?.income.expected !== null && report?.income.expected !== undefined
            ? `of ${formatMoney(report.income.expected)} expected`
            : undefined
        }
        expenseHint={report ? `of ${formatMoney(report.planned)} planned` : undefined}
        extra={savingsTile}
      />

      <BudgetCard
        key={key}
        scope="year"
        periodKey={key}
        periodLabel={key}
        budget={budget}
        report={report}
        previous={previous}
        previousLabel={previous?.period_key ?? null}
        categories={categories}
        people={personBalances(people, debts).map(({ id, name, owe, owed }) => ({
          id,
          name,
          owe,
          owed,
        }))}
      />

      <MonthPlanTable
        year={year}
        buckets={buckets}
        budgets={monthBudgets}
        investments={investments}
        thisMonth={today.slice(0, 7)}
      />

      <TransactionList
        title="Yearly entries"
        transactions={yearlyEntries}
        showDate
        empty="No yearly entries this year."
      />

      <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
        <h3 className="font-serif text-2xl">Month by month</h3>
        <p className="mb-4 text-sm text-paper/50">
          Everything logged in {year}.
        </p>
        <IncomeExpenseChart data={buckets} />
        <div className="mt-4">
          <BucketTable data={buckets} heading="Month" />
        </div>
      </section>

      <CategoryManager categories={categories} />
    </div>
  );
}

// Each month's own plan against what was actually spent and saved.
function MonthPlanTable({
  year,
  buckets,
  budgets,
  investments,
  thisMonth,
}: {
  year: number;
  buckets: Bucket[];
  budgets: Budget[];
  investments: InvestmentEntry[];
  thisMonth: string;
}) {
  const byMonth = new Map(budgets.map((b) => [b.period_key, b]));
  const rows = buckets.map((bucket) => {
    const plan = byMonth.get(bucket.key);
    return {
      bucket,
      planned: plan
        ? plan.lines
            .filter((l) => l.kind === "spend")
            .reduce((s, l) => s + l.amount, 0)
        : null,
      target: plan?.savings_target ?? null,
      saved: netSaved(
        investments.filter((e) => e.occurred_on.startsWith(bucket.key)),
      ),
    };
  });
  const planned = rows.filter((r) => r.planned !== null);
  const plannedTotal = planned.reduce((s, r) => s + (r.planned ?? 0), 0);
  const spentInPlanned = planned.reduce((s, r) => s + r.bucket.expense, 0);

  return (
    <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <h3 className="font-serif text-2xl">Monthly plans in {year}</h3>
      <p className="mb-4 text-sm text-paper/50">
        {planned.length === 0
          ? "No monthly plans yet. Open a month to set one."
          : `${planned.length} of 12 months planned · ${formatMoney(spentInPlanned)} spent against ${formatMoney(plannedTotal)} planned.`}
      </p>
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-paper/10 text-left text-xs uppercase tracking-wider text-paper/45">
              <th className="py-2 pr-3 font-medium">Month</th>
              <th className="px-3 py-2 text-right font-medium">Planned</th>
              <th className="px-3 py-2 text-right font-medium">Spent</th>
              <th className="px-3 py-2 text-right font-medium">Difference</th>
              <th className="py-2 pl-3 text-right font-medium">Saved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bucket, planned, target, saved }) => {
              const diff = planned === null ? null : planned - bucket.expense;
              const future = bucket.key > thisMonth;
              return (
                <tr
                  key={bucket.key}
                  className="border-b border-paper/5 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/financial/monthly?month=${bucket.key}`}
                      className="font-medium hover:text-ember"
                    >
                      {bucket.title.replace(` ${year}`, "")}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-paper/70">
                    {planned === null ? "—" : formatMoney(planned)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {future && bucket.expense === 0
                      ? "—"
                      : formatMoney(bucket.expense)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums ${
                      diff === null || future
                        ? "text-paper/40"
                        : diff < 0
                          ? "text-red-700 dark:text-red-300"
                          : "text-moss"
                    }`}
                  >
                    {diff === null || future
                      ? "—"
                      : `${formatMoney(Math.abs(diff))} ${diff < 0 ? "over" : "under"}`}
                  </td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">
                    {future && saved === 0 ? (
                      "—"
                    ) : (
                      <>
                        {saved < 0 ? "−" : ""}
                        {formatMoney(Math.abs(saved))}
                      </>
                    )}
                    {target !== null && (
                      <span className="text-paper/40">
                        {" "}
                        / {formatMoney(target)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-paper/40">
        Saved is money put into savings &amp; investments that month, against the plan&apos;s savings target.
      </p>
    </section>
  );
}
