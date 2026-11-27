import BudgetCard from "@/components/finance/budget/budget-card";
import CategoryManager from "@/components/finance/category-manager";
import { BucketTable, IncomeExpenseChart } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import { Card, CardGrid, Stack } from "@/components/ui/kit";
import TransactionList from "@/components/finance/transaction-list";
import {
  addMonths,
  budgetReport,
  dayBuckets,
  flowHint,
  formatMoney,
  formatMonth,
  monthRange,
  parseMonthParam,
  todayISO,
  totalsOf,
} from "@/lib/finance";
import { personBalances } from "@/lib/debts";
import {
  getBankAccounts,
  getBudget,
  getCategories,
  getDebts,
  getEmiPayments,
  getEmis,
  getInvestmentEntries,
  getPeople,
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

  const [
    transactions,
    categories,
    budget,
    previous,
    people,
    debts,
    investments,
    emis,
    emiPayments,
    banks,
  ] =
    await Promise.all([
      getTransactions({ from, to }),
      getCategories(),
      getBudget("month", month),
      getPreviousBudget("month", month),
      getPeople(),
      getDebts(),
      getInvestmentEntries({ from, to }),
      getEmis(),
      getEmiPayments({ from, to }),
      // What's in the accounts at month end, or now for this month
      getBankAccounts(to < today ? to : today),
    ]);
  const periodDebts = debts.filter(
    (d) => d.occurred_on >= from && d.occurred_on <= to,
  );
  const monthlyEntries = transactions.filter((t) => t.period === "monthly");
  const totals = totalsOf(transactions);
  const report = budget
    ? budgetReport(
        budget,
        "month",
        month,
        { transactions, debts: periodDebts, investments, emis, emiPayments },
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
  const incomeHint =
    report?.income.expected !== null && report?.income.expected !== undefined
      ? `of ${formatMoney(report.income.expected)} expected`
      : undefined;
  const expenseHint = report ? `of ${formatMoney(report.planned)} planned` : undefined;

  return (
    <Stack>
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
        balance={
          banks.length
            ? {
                total: banks.reduce((sum, a) => sum + a.balance, 0),
                hint: flowHint(totals.net, month === thisMonth ? "this month" : "that month"),
              }
            : null
        }
        incomeHint={incomeHint}
        expenseHint={expenseHint}
        extra={[
          ...savingsTile,
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
        report={report}
        previous={previous}
        previousLabel={previous ? formatMonth(previous.period_key) : null}
        categories={categories}
        emis={emis}
        people={personBalances(people, debts).map(({ id, name, owe, owed }) => ({
          id,
          name,
          owe,
          owed,
        }))}
      />

      <CardGrid>
        <TransactionList
          categories={categories}
          bankAccounts={banks}
          title="Monthly entries"
          transactions={monthlyEntries}
          showDate
          empty="No monthly entries this month."
        />

        <CategoryManager categories={categories} />
      </CardGrid>

      {/* The chart needs the whole width: a month is up to 31 pairs of bars */}
      <Card>
        <h3 className="font-bold tracking-tight text-[19px]">Day by day</h3>
        <p className="mb-4 text-sm text-paper/65">
          Everything logged in {formatMonth(month)}.
        </p>
        <IncomeExpenseChart data={dayBuckets(month, transactions)} />
        <div className="mt-4">
          <BucketTable data={dayBuckets(month, transactions)} heading="Day" />
        </div>
      </Card>

    </Stack>
  );
}
