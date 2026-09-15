import CategoryManager from "@/components/finance/category-manager";
import { CategoryBars } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionForm from "@/components/finance/transaction-form";
import TransactionList from "@/components/finance/transaction-list";
import { personBalances } from "@/lib/debts";
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
  getPeople,
  getTransactions,
} from "@/lib/finance-queries";

export default async function DailyFinancePage({
  searchParams,
}: PageProps<"/financial/daily">) {
  const date = parseDateParam((await searchParams).date);
  const today = todayISO();

  const [transactions, categories, people, debts, accounts, investments] =
    await Promise.all([
      getTransactions({ from: date, to: date }),
      getCategories(),
      getPeople(),
      getDebts(),
      getAccounts(),
      getInvestmentEntries({ from: date, to: date }),
    ]);
  const spending = categoryBreakdown(transactions, "expense");
  const dayDebts = debts.filter((d) => d.occurred_on === date);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const daySavings = investments
    .filter((e) => e.kind !== "value")
    .map((e) => ({
      ...e,
      accountName: accountById.get(e.account_id)?.name ?? "Account",
      color: accountById.get(e.account_id)?.color ?? 8,
    }));
  const balances = personBalances(people, debts).map(
    ({ id, name, owe, owed }) => ({ id, name, owe, owed }),
  );

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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <TransactionForm
          key={date}
          categories={categories}
          period="daily"
          defaultDate={date}
          people={balances}
          accounts={accounts}
        />
        <div className="flex flex-col gap-6">
          <TransactionList
            title="Entries"
            transactions={transactions}
            debts={dayDebts}
            savings={daySavings}
            empty="Nothing logged for this day yet."
          />
          {spending.length > 0 && (
            <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
              <h3 className="mb-4 font-serif text-2xl">Spending by category</h3>
              <CategoryBars slices={spending} />
            </section>
          )}
        </div>
      </div>

      <CategoryManager categories={categories} />
    </div>
  );
}
