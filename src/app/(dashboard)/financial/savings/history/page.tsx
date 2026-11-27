import Link from "next/link";
import PeriodNav from "@/components/finance/period-nav";
import { Card, Stack } from "@/components/ui/kit";
import { formatMoney, formatMonth, parseYearParam, todayISO } from "@/lib/finance";
import { getInvestmentEntries, getMonthBudgets } from "@/lib/finance-queries";

// Month by month: what went in, what came out, and whether that month's
// savings target in the plan was met.
export default async function SavingsHistoryPage({
  searchParams,
}: PageProps<"/financial/savings/history">) {
  const year = parseYearParam((await searchParams).year);
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const month = today.slice(0, 7);

  const [entries, monthBudgets] = await Promise.all([
    getInvestmentEntries({ from: `${year}-01-01`, to: `${year}-12-31` }),
    getMonthBudgets(year),
  ]);

  const byMonth = new Map(monthBudgets.map((b) => [b.period_key, b]));
  const rows = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const own = entries.filter((e) => e.occurred_on.startsWith(key));
    const put = own.filter((e) => e.kind === "deposit").reduce((s, e) => s + e.amount, 0);
    const out = own.filter((e) => e.kind === "withdrawal").reduce((s, e) => s + e.amount, 0);
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
    <Stack>
      <PeriodNav
        label={String(year)}
        prevHref={`/financial/savings/history?year=${year - 1}`}
        nextHref={`/financial/savings/history?year=${year + 1}`}
        currentHref="/financial/savings/history"
        isCurrent={year === thisYear}
        currentLabel="This year"
      />

      <Card>
        <div className="mb-3">
          <h3 className="font-bold tracking-tight text-[19px]">Saved each month</h3>
          <p className="text-sm text-paper/65">
            {formatMoney(Math.abs(yearNet))} {yearNet < 0 ? "taken out" : "saved"} in{" "}
            {year}, against the savings target in each month&apos;s plan.
          </p>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-paper/10 text-left text-xs uppercase tracking-wider text-paper/60">
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
                    <td className="px-3 py-2.5 text-right tabular-nums text-paper/78">
                      {empty ? "—" : formatMoney(r.put)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-paper/78">
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
                      {empty ? "—" : `${r.net < 0 ? "−" : ""}${formatMoney(Math.abs(r.net))}`}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-paper/65">
                      {r.target === null ? "—" : formatMoney(r.target)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Stack>
  );
}
