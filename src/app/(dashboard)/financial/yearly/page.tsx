import CategoryManager from "@/components/finance/category-manager";
import { BucketTable, IncomeExpenseChart } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionForm from "@/components/finance/transaction-form";
import TransactionList from "@/components/finance/transaction-list";
import {
  monthBuckets,
  parseYearParam,
  todayISO,
  totalsOf,
  yearRange,
} from "@/lib/finance";
import { getCategories, getTransactions } from "@/lib/finance-queries";

export default async function YearlyFinancePage({
  searchParams,
}: PageProps<"/financial/yearly">) {
  const year = parseYearParam((await searchParams).year);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const { from, to } = yearRange(year);

  const [transactions, categories] = await Promise.all([
    getTransactions({ from, to }),
    getCategories(),
  ]);
  const yearlyEntries = transactions.filter((t) => t.period === "yearly");
  const buckets = monthBuckets(year, transactions);

  return (
    <div className="flex flex-col gap-6">
      <PeriodNav
        label={String(year)}
        prevHref={`/financial/yearly?year=${year - 1}`}
        nextHref={`/financial/yearly?year=${year + 1}`}
        currentHref="/financial/yearly"
        isCurrent={year === thisYear}
        currentLabel="This year"
      />

      <StatTiles totals={totalsOf(transactions)} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <TransactionForm
          key={year}
          categories={categories}
          period="yearly"
          defaultDate={year === thisYear ? today : from}
          minDate={from}
          maxDate={to}
        />
        <div className="flex flex-col gap-6">
          <TransactionList
            title="Yearly entries"
            transactions={yearlyEntries}
            showDate
            empty="No yearly entries yet — add insurance, fees or bonuses."
          />
          <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
            <h3 className="font-serif text-2xl">Month by month</h3>
            <p className="mb-4 text-sm text-paper/50">
              Everything logged in {year}.
            </p>
            <IncomeExpenseChart data={buckets} />
            <div className="mt-4">
              <BucketTable data={buckets} heading="Month" />
            </div>
          </section>
        </div>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
