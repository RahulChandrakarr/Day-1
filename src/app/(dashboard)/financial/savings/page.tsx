import Link from "next/link";
import AccountList from "@/components/finance/savings/account-list";
import {
  AddAccountForm,
  InvestmentEntryForm,
} from "@/components/finance/savings/savings-forms";
import PeriodNav from "@/components/finance/period-nav";
import {
  formatMoney,
  formatMonth,
  formatMonthShort,
  parseYearParam,
  todayISO,
} from "@/lib/finance";
import {
  getAccounts,
  getInvestmentEntries,
  getMonthBudgets,
} from "@/lib/finance-queries";
import { accountSummaries, netSaved } from "@/lib/investments";

export default async function SavingsPage({
  searchParams,
}: PageProps<"/financial/savings">) {
  const year = parseYearParam((await searchParams).year);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const month = today.slice(0, 7);

  const [accounts, entries, monthBudgets] = await Promise.all([
    getAccounts(),
    getInvestmentEntries(),
    getMonthBudgets(year),
  ]);
  const summaries = accountSummaries(accounts, entries);
  const invested = summaries.reduce((s, a) => s + a.invested, 0);
  const current = summaries.reduce((s, a) => s + a.current, 0);
  const gain = current - invested;
  const savedThisMonth = netSaved(
    entries.filter((e) => e.occurred_on.startsWith(month)),
  );
  const monthTarget =
    monthBudgets.find((b) => b.period_key === month)?.savings_target ?? null;

  const tiles = [
    {
      label: "Worth now",
      value: formatMoney(current),
      hint: `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`,
    },
    {
      label: "Put in",
      value: formatMoney(invested),
      hint: "Deposits minus withdrawals",
    },
    {
      label: "Returns",
      value: `${gain < 0 ? "−" : "+"}${formatMoney(Math.abs(gain))}`,
      hint:
        invested > 0
          ? `${gain < 0 ? "−" : "+"}${Math.abs((gain / invested) * 100).toFixed(1)}% overall`
          : "Update values to see returns",
      tone: gain > 0 ? "text-moss" : gain < 0 ? "text-red-700 dark:text-red-300" : "",
    },
    {
      label: `Saved in ${formatMonthShort(month)}`,
      value: `${savedThisMonth < 0 ? "−" : ""}${formatMoney(Math.abs(savedThisMonth))}`,
      hint:
        monthTarget !== null
          ? `of ${formatMoney(monthTarget)} target`
          : "No savings target set",
      tone:
        monthTarget !== null
          ? savedThisMonth >= monthTarget
            ? "text-moss"
            : ""
          : "",
    },
  ];

  // Month by month: saved vs the plan's savings target
  const byMonth = new Map(monthBudgets.map((b) => [b.period_key, b]));
  const rows = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const own = entries.filter((e) => e.occurred_on.startsWith(key));
    const put = own
      .filter((e) => e.kind === "deposit")
      .reduce((s, e) => s + e.amount, 0);
    const out = own
      .filter((e) => e.kind === "withdrawal")
      .reduce((s, e) => s + e.amount, 0);
    return {
      key,
      put,
      out,
      net: put - out,
      target: byMonth.get(key)?.savings_target ?? null,
      future: key > month,
    };
  });
  const yearNet = rows.reduce((s, r) => s + r.net, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-paper/10 bg-surface/60 p-4 sm:p-5"
          >
            <p className="text-sm text-paper/55">{tile.label}</p>
            <p
              className={`mt-2 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl xl:text-3xl ${tile.tone ?? ""}`}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-paper/45">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
        <div className="flex flex-col gap-6">
          <InvestmentEntryForm accounts={accounts} defaultDate={today} />
          <AddAccountForm startOpen={accounts.length === 0} />
        </div>
        <AccountList accounts={summaries} />
      </div>

      <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-serif text-2xl">Saved each month</h3>
            <p className="text-sm text-paper/50">
              {formatMoney(Math.max(yearNet, 0))} saved in {year}, against the
              savings target in each month&apos;s plan.
            </p>
          </div>
        </div>
        <PeriodNav
          label={String(year)}
          prevHref={`/financial/savings?year=${year - 1}`}
          nextHref={`/financial/savings?year=${year + 1}`}
          currentHref="/financial/savings"
          isCurrent={year === thisYear}
          currentLabel="This year"
        />
        <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-paper/10 text-left text-xs uppercase tracking-wider text-paper/45">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Put in</th>
                <th className="px-3 py-2 text-right font-medium">Took out</th>
                <th className="px-3 py-2 text-right font-medium">Saved</th>
                <th className="py-2 pl-3 text-right font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const empty = r.future && r.put === 0 && r.out === 0;
                return (
                  <tr key={r.key} className="border-b border-paper/5 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/financial/monthly?month=${r.key}`}
                        className="font-medium hover:text-ember"
                      >
                        {formatMonth(r.key).replace(` ${year}`, "")}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-paper/70">
                      {empty ? "—" : formatMoney(r.put)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-paper/70">
                      {empty ? "—" : formatMoney(r.out)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-medium tabular-nums ${
                        !empty && r.target !== null
                          ? r.net >= r.target
                            ? "text-moss"
                            : r.future
                              ? ""
                              : "text-red-700 dark:text-red-300"
                          : ""
                      }`}
                    >
                      {empty
                        ? "—"
                        : `${r.net < 0 ? "−" : ""}${formatMoney(Math.abs(r.net))}`}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-paper/50">
                      {r.target === null ? "—" : formatMoney(r.target)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
