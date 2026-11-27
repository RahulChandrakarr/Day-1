import EmiList from "@/components/finance/emi/emi-list";
import { emiSummaries } from "@/lib/emis";
import { formatMoney, formatShortDate, todayISO } from "@/lib/finance";
import { getEmiPayments, getEmis } from "@/lib/finance-queries";
import { Stack } from "@/components/ui/kit";

export default async function EmiPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const [emis, payments] = await Promise.all([getEmis(), getEmiPayments()]);
  const summaries = emiSummaries(emis, payments, today);
  const running = summaries.filter((e) => e.remaining > 0);
  const monthly = running.reduce((s, e) => s + e.monthly_amount, 0);
  const remaining = running.reduce((s, e) => s + e.remaining, 0);
  const paid = summaries.reduce((s, e) => s + e.paid, 0);
  const dueThisMonth = running.filter(
    (e) => e.nextDueOn !== null && (e.overdue || e.nextDueOn.startsWith(month)),
  );
  const overdue = dueThisMonth.filter((e) => e.overdue);

  const tiles = [
    {
      label: "Monthly EMI",
      value: formatMoney(monthly),
      hint:
        running.length === 0
          ? "No running EMIs"
          : `${running.length} ${running.length === 1 ? "EMI" : "EMIs"} still going`,
    },
    {
      label: "Still to pay",
      value: formatMoney(remaining),
      hint: paid ? `${formatMoney(paid)} already paid` : "Nothing logged yet",
    },
    {
      label: "This month",
      value:
        dueThisMonth.length === 0
          ? running.length
            ? "All paid"
            : "—"
          : formatMoney(
              dueThisMonth.reduce((s, e) => s + e.monthly_amount, 0),
            ),
      hint:
        overdue.length > 0
          ? `${overdue.length} overdue`
          : dueThisMonth.length === 0
            ? running.length
              ? "Every installment is in"
              : "Add an EMI to start"
            : `${dueThisMonth.length} still due${
                dueThisMonth[0]?.nextDueOn
                  ? ` · next ${formatShortDate(dueThisMonth[0].nextDueOn)}`
                  : ""
              }`,
      tone: overdue.length > 0 ? "text-red-700 dark:text-red-300" : "",
    },
  ];

  return (
    <Stack>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`card p-4 ${
              i === 2 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <p className="text-sm text-paper/70">{tile.label}</p>
            <p
              className={`mt-2 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl xl:text-3xl ${tile.tone ?? ""}`}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-paper/60">{tile.hint}</p>
          </div>
        ))}
      </div>

      <EmiList emis={summaries} />
    </Stack>
  );
}
