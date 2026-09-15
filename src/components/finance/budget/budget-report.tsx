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

      <div className="grid gap-3 sm:grid-cols-3">
        <CompareTile
          label="Spent"
          actual={actual}
          target={planned}
          targetLabel="planned"
          goodWhenLower
        />
        <CompareTile
          label="Income"
          actual={report.income.actual}
          target={report.income.expected}
          targetLabel="expected"
        />
        <CompareTile
          label="Saved"
          actual={report.savings.actual}
          target={report.savings.target}
          targetLabel="target"
        />
      </div>

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
                  <span className="truncate">{row.name}</span>
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

function CompareTile({
  label,
  actual,
  target,
  targetLabel,
  goodWhenLower,
}: {
  label: string;
  actual: number;
  target: number | null;
  targetLabel: string;
  goodWhenLower?: boolean;
}) {
  const hasTarget = target !== null && target > 0;
  const good = hasTarget
    ? goodWhenLower
      ? actual <= target
      : actual >= target
    : null;
  const sign = actual < 0 ? "−" : "";

  return (
    <div className="rounded-2xl border border-paper/10 bg-ink/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-paper/50">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
        {sign}
        {formatMoney(Math.abs(actual))}
      </p>
      <p
        className={`mt-0.5 text-xs ${
          good === null ? "text-paper/40" : good ? "text-moss" : badText
        }`}
      >
        {hasTarget
          ? `of ${formatMoney(target)} ${targetLabel}`
          : `No ${targetLabel} set`}
      </p>
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
          {row.note && (
            <span className="hidden truncate text-paper/40 sm:inline">
              · {row.note}
            </span>
          )}
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
    </li>
  );
}
