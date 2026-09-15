import BudgetCard from "@/components/finance/budget/budget-card";
import CategoryManager from "@/components/finance/category-manager";
import { BucketTable, IncomeExpenseChart } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionForm from "@/components/finance/transaction-form";
import TransactionList from "@/components/finance/transaction-list";
import {
  addMonths,
  budgetReport,
  dayBuckets,
  formatMonth,
  monthRange,
  parseMonthParam,
  todayISO,
  totalsOf,
} from "@/lib/finance";
import {
  getBudget,
  getCategories,
  getPreviousBudget,
  getTransactions,
} from "@/lib/finance-queries";

export default async function MonthlyFinancePage({
  searchParams,
}: PageProps<"/financial/monthly">) {
  const month = parseMonthParam((await searchParams).month);
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const { from, to } = monthRange(month);

  const [transactions, categories, budget, previous] = await Promise.all([
    getTransactions({ from, to }),
    getCategories(),
    getBudget("month", month),
    getPreviousBudget("month", month),
  ]);
  const monthlyEntries = transactions.filter((t) => t.period === "monthly");
  const totals = totalsOf(transactions);

  return (
    <div className="flex flex-col gap-6">
      <PeriodNav
        label={formatMonth(month)}
        prevHref={`/financial/monthly?month=${addMonths(month, -1)}`}
        nextHref={`/financial/monthly?month=${addMonths(month, 1)}`}
        currentHref="/financial/monthly"
        isCurrent={month === thisMonth}
        currentLabel="This month"
      />

      <StatTiles
        totals={totals}
        extra={[
          {
            label: "Monthly bills",
            value: `${monthlyEntries.filter((t) => t.type === "expense").length}`,
            hint: "Recurring expenses logged",
          },
        ]}
      />

      <BudgetCard
        key={month}
        scope="month"
        periodKey={month}
        periodLabel={formatMonth(month)}
        budget={budget}
        report={
          budget
            ? budgetReport(budget, "month", month, transactions, today)
            : null
        }
        previous={previous}
        previousLabel={previous ? formatMonth(previous.period_key) : null}
        categories={categories}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <TransactionForm
          key={month}
          categories={categories}
          period="monthly"
          defaultDate={month === thisMonth ? today : from}
          minDate={from}
          maxDate={to}
        />
        <div className="flex flex-col gap-6">
          <TransactionList
            title="Monthly entries"
            transactions={monthlyEntries}
            showDate
            empty="No monthly entries yet — add rent, salary or subscriptions."
          />
          <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
            <h3 className="font-serif text-2xl">Day by day</h3>
            <p className="mb-4 text-sm text-paper/50">
              Everything logged in {formatMonth(month)}.
            </p>
            <IncomeExpenseChart data={dayBuckets(month, transactions)} />
            <div className="mt-4">
              <BucketTable
                data={dayBuckets(month, transactions)}
                heading="Day"
              />
            </div>
          </section>
        </div>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
