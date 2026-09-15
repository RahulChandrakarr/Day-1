import Link from "next/link";
import { formatMoney, type BudgetReport } from "@/lib/finance";

// Compact "this month's plan" card for the Overview page.
export default function PlanSummary({
  report,
  monthLabel,
}: {
  report: BudgetReport | null;
  monthLabel: string;
}) {
  if (!report) {
    return (
      <Link
        href="/financial/monthly"
        className="group flex flex-col gap-2 rounded-3xl border border-dashed border-paper/15 p-5 transition hover:border-ember/50 sm:p-6"
      >
        <h3 className="font-serif text-2xl">Plan {monthLabel}</h3>
        <p className="text-sm text-paper/55">
          No plan yet. Decide how much goes to rent, EMI, bills and savings, then
          track it as you spend.
        </p>
        <span className="mt-1 text-sm font-medium text-ember">
          Create a plan →
        </span>
      </Link>
    );
  }

  const { planned, actual, savings, progress } = report;
  const used = planned > 0 ? Math.min(actual / planned, 1) : 0;
  const over = actual > planned;
  const overCount = report.rows.filter((r) => r.actual > r.planned).length;

  return (
    <Link
      href="/financial/monthly"
      className="flex flex-col gap-4 rounded-3xl border border-paper/10 bg-surface/60 p-5 transition hover:border-paper/25 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-2xl">{monthLabel} plan</h3>
        {progress && (
          <span className="text-xs text-paper/45">
            {progress.daysLeft} {progress.daysLeft === 1 ? "day" : "days"} left
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatMoney(actual)}
          <span className="text-base font-normal text-paper/45">
            {" "}
            of {formatMoney(planned)}
          </span>
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper/10">
          <div
            className={`h-full rounded-full ${over ? "bg-chart-expense" : "bg-ember"}`}
            style={{ width: `${used * 100}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-paper/45">
            {over ? "Over plan" : "Left to spend"}
          </dt>
          <dd
            className={`font-medium tabular-nums ${over ? "text-red-700 dark:text-red-300" : ""}`}
          >
            {formatMoney(Math.abs(planned - actual))}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-paper/45">Saved so far</dt>
          <dd className="font-medium tabular-nums">
            {savings.actual < 0 ? "−" : ""}
            {formatMoney(Math.abs(savings.actual))}
            {savings.target !== null && (
              <span className="text-paper/45">
                {" "}
                / {formatMoney(savings.target)}
              </span>
            )}
          </dd>
        </div>
      </dl>
      {overCount > 0 && (
        <p className="text-xs text-red-700 dark:text-red-300">
          {overCount} {overCount === 1 ? "category is" : "categories are"} over
          plan
        </p>
      )}
    </Link>
  );
}
