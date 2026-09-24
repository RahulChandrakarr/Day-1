import BankAccounts from "@/components/finance/bank-accounts";
import { Card, Rail, Stack } from "@/components/ui/kit";
import CategoryManager from "@/components/finance/category-manager";
import { CategoryBars } from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionList from "@/components/finance/transaction-list";
import {
  addDays,
  cashFlow,
  categoryBreakdown,
  flowHint,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import {
  getAccounts,
  getBankAccounts,
  getCategories,
  getDebts,
  getEmiPayments,
  getEmis,
  getInvestmentEntries,
  getTransactions,
  getTransfers,
} from "@/lib/finance-queries";

export default async function DailyFinancePage({
  searchParams,
}: PageProps<"/financial/daily">) {
  const date = parseDateParam((await searchParams).date);
  const today = todayISO();

  // Balances at the end of the day shown, or now for today and later
  const asOf = date < today ? date : today;
  const [transactions, categories, debts, accounts, investments, emiRows, emiPayments, banks, transfers] =
    await Promise.all([
      getTransactions({ from: date, to: date }),
      getCategories(),
      getDebts({ from: date, to: date }),
      getAccounts(),
      getInvestmentEntries({ from: date, to: date }),
      getEmis(),
      getEmiPayments({ from: date, to: date }),
      getBankAccounts(asOf),
      getTransfers({ from: date, to: date }),
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
  const emiById = new Map(emiRows.map((e) => [e.id, e]));
  const dayEmis = emiPayments.map((p) => ({
    ...p,
    emiName: emiById.get(p.emi_id)?.name ?? "EMI",
    color: emiById.get(p.emi_id)?.color ?? 8,
  }));

  const flow = cashFlow(transactions, dayDebts, daySavings);

  return (
    <Stack>
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
        totals={flow}
        balance={
          banks.length
            ? {
                total: banks.reduce((sum, a) => sum + a.balance, 0),
                hint: flowHint(flow.net, date === today ? "today" : "that day"),
              }
            : null
        }
        netHint={
          dayDebts.some((d) => d.in_balance) || daySavings.length
            ? "Cash left after spending, saving and borrow entries you added"
            : undefined
        }
      />

      {/* Entries lead; accounts and spending sit beside them once there's room */}
      <Rail
        aside={
          <>
            <BankAccounts accounts={banks} asOf={asOf} today={today} />
            {spending.length > 0 && (
              <Card>
                <h3 className="mb-3 font-serif text-[19px]">Spending by category</h3>
                <CategoryBars slices={spending} />
              </Card>
            )}
          </>
        }
      >
        <TransactionList
          categories={categories}
          bankAccounts={banks}
          title="Entries"
          transactions={transactions}
          debts={dayDebts}
          savings={daySavings}
          emis={dayEmis}
          transfers={transfers}
          empty="Nothing logged for this day yet. Tap Add entry above."
        />
      </Rail>

      <CategoryManager categories={categories} />
    </Stack>
  );
}
