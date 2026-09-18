"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { formatMoney, type BudgetReport, type BudgetRow } from "@/lib/finance";

const badText = "text-red-700 dark:text-red-300";

export default function BudgetReportView({
  report,
  periodLabel,
}: {
  report: BudgetReport;
  periodLabel: string;
}) {
  const { planned, actual, progress, ended } = report;
  const diff = planned - actual;

  return (
    <div className="flex flex-col gap-6">
      <Headline report={report} periodLabel={periodLabel} diff={diff} />

      {planned > 0 && (
        <OverallBar
          planned={planned}
          actual={actual}
          elapsed={progress?.elapsed ?? (ended ? 1 : 0)}
        />
      )}

      <PlanTotals report={report} />

      {report.rows.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-paper/50">
            By category
          </h4>
          <ul className="flex flex-col gap-4">
            {report.rows.map((row, i) => (
              <CategoryRow key={row.id} row={row} index={i} />
            ))}
          </ul>
        </div>
      )}

      {report.repay.length > 0 && (
        <PersonSection
          title="Money to return"
          done="returned"
          rows={report.repay}
        />
      )}

      {report.collect.length > 0 && (
        <PersonSection
          title="Money to collect"
          done="received"
          rows={report.collect}
        />
      )}

      {report.unplanned.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-paper/50">
            Not in the plan
          </h4>
          <p className="mb-3 text-sm text-paper/45">
            {formatMoney(report.unplanned.reduce((s, r) => s + r.actual, 0))}{" "}
            spent in categories you didn&apos;t plan for.
          </p>
          <ul className="flex flex-col divide-y divide-paper/5">
            {report.unplanned.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: `var(--cat-${row.color})` }}
                  />
                  <span className="min-w-0 truncate">{row.name}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(row.actual)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// What the plan adds up to: everything going out, and what is left of the
// expected income once it is all covered.
function PlanTotals({ report }: { report: BudgetReport }) {
  const repay = report.repay.reduce((sum, r) => sum + r.planned, 0);
  const collect = report.collect.reduce((sum, r) => sum + r.planned, 0);
  const savings = report.savings.target ?? 0;
  const expected = report.income.expected;
  const out = report.planned + repay + savings;
  const left = expected === null ? null : expected + collect - out;
  // Nothing worth adding up beyond the tiles above
  if (!out || (left === null && !repay && !savings)) return null;

  return (
    <div>
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-paper/50">
        Plan totals
      </h4>
      <ul className="flex flex-col divide-y divide-paper/5 text-sm">
        <TotalRow label="Planned spending" amount={report.planned} />
        {repay > 0 && <TotalRow label="Money to return" amount={repay} />}
        {savings > 0 && <TotalRow label="Into savings" amount={savings} />}
        <TotalRow label="Total going out" amount={out} strong />
        {left !== null && (
          <>
            <TotalRow label="Expected income" amount={expected ?? 0} />
            {collect > 0 && <TotalRow label="Money to collect" amount={collect} />}
            <TotalRow
              label={left < 0 ? "Short by" : savings > 0 ? "Left over" : "Left to save"}
              amount={Math.abs(left)}
              strong
              tone={left < 0 ? badText : "text-moss"}
            />
          </>
        )}
      </ul>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  strong = false,
  tone,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 py-2 ${
        strong ? "font-semibold" : "text-paper/70"
      }`}
    >
      <span className="min-w-0">{label}</span>
      <span className={`shrink-0 tabular-nums ${tone ?? ""}`}>
        {formatMoney(amount)}
      </span>
    </li>
  );
}

function Headline({
  report,
  periodLabel,
  diff,
}: {
  report: BudgetReport;
  periodLabel: string;
  diff: number;
}) {
  const { planned, actual, progress, ended } = report;
  const over = diff < 0;

  if (ended) {
    return (
      <p className="font-serif text-2xl leading-snug sm:text-3xl">
        You planned <Figure>{formatMoney(planned)}</Figure> and spent{" "}
        <Figure>{formatMoney(actual)}</Figure> in {periodLabel} —{" "}
        <span className={over ? badText : "text-moss"}>
          {formatMoney(Math.abs(diff))} {over ? "over" : "under"} plan
        </span>
        .
      </p>
    );
  }

  if (progress) {
    const pace = progress.projected - planned;
    return (
      <div>
        <p className="font-serif text-2xl leading-snug sm:text-3xl">
          <Figure>{formatMoney(actual)}</Figure> of{" "}
          <Figure>{formatMoney(planned)}</Figure> spent
        </p>
        <p className="mt-1 text-sm text-paper/55">
          {over
            ? `${formatMoney(-diff)} over plan already`
            : `${formatMoney(diff)} left`}{" "}
          · {progress.daysLeft} {progress.daysLeft === 1 ? "day" : "days"} left
          · heading for{" "}
          <span className={pace > 0 ? badText : "text-moss"}>
            {formatMoney(Math.round(progress.projected))}
          </span>
        </p>
      </div>
    );
  }

  return (
    <p className="font-serif text-2xl leading-snug sm:text-3xl">
      Plan ready: <Figure>{formatMoney(planned)}</Figure> to spend in{" "}
      {periodLabel}.
    </p>
  );
}

function Figure({ children }: { children: ReactNode }) {
  return <span className="font-sans font-semibold tracking-tight">{children}</span>;
}

function OverallBar({
  planned,
  actual,
  elapsed,
}: {
  planned: number;
  actual: number;
  elapsed: number;
}) {
  const scale = Math.max(planned, actual);
  const within = Math.min(actual, planned) / scale;
  const overflow = Math.max(actual - planned, 0) / scale;
  const plannedEdge = planned / scale;

  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-paper/10">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-ember"
          initial={{ width: 0 }}
          animate={{ width: `${within * 100}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        {overflow > 0 && (
          <motion.div
            className="absolute inset-y-0 bg-chart-expense"
            style={{ left: `${plannedEdge * 100}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${overflow * 100}%` }}
            transition={{ delay: 0.5, duration: 0.5 }}
          />
        )}
        {elapsed > 0 && elapsed < 1 && (
          <span
            title="Time elapsed"
            className="absolute inset-y-0 w-0.5 bg-paper/60"
            style={{ left: `${elapsed * plannedEdge * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-paper/45">
        <span>{Math.round((actual / planned) * 100)}% of plan used</span>
        {elapsed > 0 && elapsed < 1 && (
          <span>{Math.round(elapsed * 100)}% of the time gone</span>
        )}
      </div>
    </div>
  );
}

function CategoryRow({ row, index }: { row: BudgetRow; index: number }) {
  const scale = Math.max(row.planned, row.actual, 1);
  const within = Math.min(row.actual, row.planned) / scale;
  const overflow = Math.max(row.actual - row.planned, 0) / scale;
  const diff = row.planned - row.actual;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: `var(--cat-${row.color})` }}
          />
          <span className="truncate font-medium">{row.name}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {formatMoney(row.actual)}
          <span className="text-paper/40"> / {formatMoney(row.planned)}</span>
        </span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-paper/10">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `var(--cat-${row.color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${within * 100}%` }}
          transition={{ delay: 0.04 * index, duration: 0.6 }}
        />
        {overflow > 0 && (
          <motion.div
            className="absolute inset-y-0 bg-chart-expense"
            style={{ left: `${(row.planned / scale) * 100}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${overflow * 100}%` }}
            transition={{ delay: 0.04 * index + 0.4, duration: 0.4 }}
          />
        )}
      </div>
      <p className={`mt-1 text-xs ${diff < 0 ? badText : "text-paper/45"}`}>
        {diff < 0
          ? `${formatMoney(-diff)} over`
          : row.actual === 0
            ? "Nothing spent yet"
            : `${formatMoney(diff)} left`}
      </p>
      {row.items.some((item) => item.label) && (
        <ul className="mt-2 flex flex-col gap-1 border-l border-paper/10 pl-3 text-xs text-paper/55">
          {row.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{item.label ?? row.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PersonSection({
  title,
  done,
  rows,
}: {
  title: string;
  done: string;
  rows: BudgetRow[];
}) {
  const planned = rows.reduce((sum, r) => sum + r.planned, 0);
  const actual = rows.reduce((sum, r) => sum + Math.min(r.actual, r.planned), 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-paper/50">
          {title}
        </h4>
        <span className="text-xs text-paper/45 tabular-nums">
          {formatMoney(actual)} of {formatMoney(planned)} {done}
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const complete = row.actual >= row.planned;
          const share = Math.min(row.actual / row.planned, 1);
          return (
            <li
              key={row.id}
              className="rounded-2xl border border-paper/10 bg-ink p-3"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/10 text-xs font-medium">
                  {row.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {row.name}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    complete ? "text-moss" : "text-paper/55"
                  }`}
                >
                  {complete
                    ? `Done · ${formatMoney(row.actual)}`
                    : `${formatMoney(row.actual)} / ${formatMoney(row.planned)}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper/10">
                <motion.div
                  className={`h-full rounded-full ${complete ? "bg-moss" : "bg-ember"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
              {row.items.some((item) => item.label) && (
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-paper/50">
                  {row.items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{item.label ?? "—"}</span>
                      <span className="tabular-nums">
                        {formatMoney(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
