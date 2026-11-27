import Link from "next/link";
import BudgetCard from "@/components/finance/budget/budget-card";
import { BucketTable, IncomeExpenseChart } from "@/components/finance/charts";
import Fold from "@/components/finance/fold";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import { Card, Stack } from "@/components/ui/kit";
import TransactionList from "@/components/finance/transaction-list";
import {
  budgetReport,
  flowHint,
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
  getBankAccounts,
  getBudget,
  getCategories,
  getDebts,
  getEmiPayments,
  getEmis,
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
    emis,
    emiPayments,
    banks,
  ] = await Promise.all([
    getTransactions({ from, to }),
    getCategories(),
    getBudget("year", key),
    getPreviousBudget("year", key),
    getMonthBudgets(year),
    getPeople(),
    getDebts(),
    getInvestmentEntries({ from, to }),
    getEmis(),
    getEmiPayments({ from, to }),
    // What's in the accounts at year end, or now for this year
    getBankAccounts(to < today ? to : today),
  ]);
  const yearlyEntries = transactions.filter((t) => t.period === "yearly");
  const totals = totalsOf(transactions);
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
          emis,
          emiPayments,
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
    <Stack>
      <PeriodNav
        label={key}
        prevHref={`/financial/yearly?year=${year - 1}`}
        nextHref={`/financial/yearly?year=${year + 1}`}
        currentHref="/financial/yearly"
        isCurrent={year === thisYear}
        currentLabel="This year"
      />

      <StatTiles
        totals={totals}
        balance={
          banks.length
            ? {
                total: banks.reduce((sum, a) => sum + a.balance, 0),
                hint: flowHint(
                  totals.net,
                  year === thisYear ? "this year" : "that year",
                ),
              }
            : null
        }
        incomeHint={
          report?.income.expected !== null && report?.income.expected !== undefined
            ? `of ${formatMoney(report.income.expected)} expected`
            : undefined
        }
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
        emis={emis}
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
        categories={categories}
        bankAccounts={banks}
        title="Yearly entries"
        transactions={yearlyEntries}
        showDate
        empty="No yearly entries this year."
      />

      {/* Twelve pairs of bars: full width or nothing */}
      <Card>
        <h3 className="mb-4 font-bold tracking-tight text-[19px]">Month by month</h3>
        <IncomeExpenseChart data={buckets} />
        <div className="mt-4">
          <BucketTable data={buckets} heading="Month" />
        </div>
      </Card>

    </Stack>
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
    <Fold
      title="Month by month plan"
      aside={`${planned.length} of 12 planned`}
      className="card px-5 py-1"
    >
      <p className="mb-4 pt-1 text-sm text-paper/65">
        {planned.length === 0
          ? "No monthly plans yet. Open a month to set one."
          : `${formatMoney(spentInPlanned)} spent against ${formatMoney(plannedTotal)} planned in those months.`}
      </p>
      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-paper/10 text-left text-xs uppercase tracking-wider text-paper/60">
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
                  <td className="px-3 py-2.5 text-right tabular-nums text-paper/78">
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
                        ? "text-paper/55"
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
                      <span className="text-paper/55">
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
    </Fold>
  );
}
