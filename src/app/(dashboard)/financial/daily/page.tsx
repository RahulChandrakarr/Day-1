import CategoryManager from "@/components/finance/category-manager";
import { CategoryBars } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionList from "@/components/finance/transaction-list";
import {
  addDays,
  cashFlow,
  categoryBreakdown,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import {
  getAccounts,
  getCategories,
  getDebts,
  getInvestmentEntries,
  getTransactions,
} from "@/lib/finance-queries";

export default async function DailyFinancePage({
  searchParams,
}: PageProps<"/financial/daily">) {
  const date = parseDateParam((await searchParams).date);
  const today = todayISO();

  const [transactions, categories, debts, accounts, investments] =
    await Promise.all([
      getTransactions({ from: date, to: date }),
      getCategories(),
      getDebts({ from: date, to: date }),
      getAccounts(),
      getInvestmentEntries({ from: date, to: date }),
    ]);
  const spending = categoryBreakdown(transactions, "expense");
  const dayDebts = debts;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const daySavings = investments
    .filter((e) => e.kind !== "value")
    .map((e) => ({
      ...e,
      accountName: accountById.get(e.account_id)?.name ?? "Account",
      color: accountById.get(e.account_id)?.color ?? 8,
    }));

  return (
    <div className="flex flex-col gap-6">
      <PeriodNav
        label={
          date === today
            ? `Today · ${formatFullDate(date)}`
            : formatFullDate(date)
        }
        prevHref={`/financial/daily?date=${addDays(date, -1)}`}
        nextHref={`/financial/daily?date=${addDays(date, 1)}`}
        currentHref="/financial/daily"
        isCurrent={date === today}
        currentLabel="Today"
      />

      <StatTiles
        totals={cashFlow(transactions, dayDebts, daySavings)}
        netHint={
          dayDebts.some((d) => d.in_balance) || daySavings.length
            ? "Cash left after spending, saving and borrow entries you added"
            : undefined
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <TransactionList
          title="Entries"
          transactions={transactions}
          debts={dayDebts}
          savings={daySavings}
          empty="Nothing logged for this day yet. Tap Add entry above."
        />
        {spending.length > 0 && (
          <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
            <h3 className="mb-4 font-serif text-2xl">Spending by category</h3>
            <CategoryBars slices={spending} />
          </section>
        )}
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
