import Link from "next/link";
import {
  BalanceChart,
  BucketTable,
  CategoryBars,
  IncomeExpenseChart,
} from "@/components/finance/charts";
import PeriodNav from "@/components/finance/period-nav";
import StatTiles from "@/components/finance/stat-tiles";
import TransactionList from "@/components/finance/transaction-list";
import {
  addMonths,
  categoryBreakdown,
  dayBuckets,
  daysInMonth,
  formatMoney,
  formatMonth,
  monthBuckets,
  monthRange,
  parseMonthParam,
  parseYearParam,
  todayISO,
  totalsOf,
  yearBuckets,
  yearRange,
  type Bucket,
} from "@/lib/finance";
import { getTransactions, getYearsWithData } from "@/lib/finance-queries";

type View = "daily" | "monthly" | "yearly";

const views: { id: View; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <h3 className="font-serif text-2xl">{title}</h3>
      {subtitle && <p className="text-sm text-paper/50">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function TrackingPage({
  searchParams,
}: PageProps<"/financial/tracking">) {
  const params = await searchParams;
  const view: View =
    params.view === "monthly" || params.view === "yearly"
      ? params.view
      : "daily";
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));

  let label: string;
  let range: { from?: string; to?: string };
  let nav: {
    prev: string;
    next: string;
    isCurrent: boolean;
    currentLabel: string;
  } | null = null;
  let days: number;
  let years: number[] = [];

  if (view === "daily") {
    const month = parseMonthParam(params.month);
    const thisMonth = today.slice(0, 7);
    label = formatMonth(month);
    range = monthRange(month);
    days = month === thisMonth ? Number(today.slice(8)) : daysInMonth(month);
    nav = {
      prev: `?view=daily&month=${addMonths(month, -1)}`,
      next: `?view=daily&month=${addMonths(month, 1)}`,
      isCurrent: month === thisMonth,
      currentLabel: "This month",
    };
  } else if (view === "monthly") {
    const year = parseYearParam(params.year);
    label = String(year);
    range = yearRange(year);
    days = year === thisYear ? dayOfYear(today) : 365;
    nav = {
      prev: `?view=monthly&year=${year - 1}`,
      next: `?view=monthly&year=${year + 1}`,
      isCurrent: year === thisYear,
      currentLabel: "This year",
    };
  } else {
    years = await getYearsWithData(thisYear);
    label = `${years[0]} – ${years[years.length - 1]}`;
    range = {
      from: `${years[0]}-01-01`,
      to: `${years[years.length - 1]}-12-31`,
    };
    days = Math.max(1, (years.length - 1) * 365 + dayOfYear(today));
  }

  const transactions = await getTransactions(range);
  const totals = totalsOf(transactions);

  let buckets: Bucket[];
  if (view === "daily")
    buckets = dayBuckets(range.from!.slice(0, 7), transactions);
  else if (view === "monthly")
    buckets = monthBuckets(Number(range.from!.slice(0, 4)), transactions);
  else buckets = yearBuckets(years, transactions);

  const savingsRate =
    totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null;
  const spending = categoryBreakdown(transactions, "expense");
  const earning = categoryBreakdown(transactions, "income");
  const biggest = [...transactions]
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const unit = view === "daily" ? "Day" : view === "monthly" ? "Month" : "Year";

  return (
    <div className="flex flex-col gap-6">
      {/* Filters: one row above everything they scope */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-paper/10 p-1">
          {views.map((v) => (
            <Link
              key={v.id}
              href={`?view=${v.id}`}
              aria-current={view === v.id ? "page" : undefined}
              className={`h-9 rounded-lg px-4 text-sm leading-9 transition ${
                view === v.id
                  ? "bg-paper/10 font-medium text-paper"
                  : "text-paper/55 hover:text-paper"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        {nav ? (
          <PeriodNav
            label={label}
            prevHref={nav.prev}
            nextHref={nav.next}
            currentHref={`?view=${view}`}
            isCurrent={nav.isCurrent}
            currentLabel={nav.currentLabel}
          />
        ) : (
          <h2 className="px-2 text-lg font-medium sm:text-xl">{label}</h2>
        )}
      </div>

      <StatTiles
        totals={totals}
        extra={[
          {
            label: "Savings rate",
            value: savingsRate === null ? "—" : `${savingsRate}%`,
            hint: `Avg spend ${formatMoney(Math.round(totals.expense / days))}/day`,
          },
        ]}
      />

      <Card
        title="Income vs expenses"
        subtitle={`${unit} by ${unit.toLowerCase()} · hover a column for details`}
      >
        <IncomeExpenseChart data={buckets} />
        <div className="mt-4">
          <BucketTable data={buckets} heading={unit} />
        </div>
      </Card>

      <Card
        title="Running balance"
        subtitle="Income minus expenses, added up over time"
      >
        <BalanceChart data={buckets} />
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Where money went" subtitle="Expenses by category">
          <CategoryBars slices={spending} />
        </Card>
        <Card title="Where money came from" subtitle="Income by category">
          <CategoryBars slices={earning} />
        </Card>
      </div>

      <TransactionList
        title="Biggest expenses"
        transactions={biggest}
        showDate
        empty="No expenses in this range."
      />
    </div>
  );
}

function dayOfYear(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}
