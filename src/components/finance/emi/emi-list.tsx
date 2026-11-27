"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteEmi, deleteEmiPayment } from "@/app/(dashboard)/financial/emi/actions";
import { AddEmiButton, EditEmiForm, PayForm } from "@/components/finance/emi/emi-forms";
import Sheet from "@/components/ui/sheet";
import { dueDayLabel, type EmiPayment, type EmiSummary } from "@/lib/emis";
import { formatMoney, formatShortDate } from "@/lib/finance";
import { Card } from "@/components/ui/kit";

// Payments shown before "Show all"
const RECENT = 3;

// Real buttons rather than text links, tall enough for a thumb
const quietButton =
  "flex h-10 items-center rounded-full border border-paper/15 px-4 text-sm font-medium text-paper/78 transition disabled:opacity-50";

function monthsLabel(emi: EmiSummary) {
  if (emi.tenure)
    return `${emi.monthsDone} of ${emi.tenure} month${emi.tenure === 1 ? "" : "s"}`;
  if (emi.monthsDone === 0) return "Not started";
  return `${emi.monthsDone} month${emi.monthsDone === 1 ? "" : "s"} done`;
}

function dueLabel(emi: EmiSummary) {
  if (!emi.nextDueOn) return null;
  const on = formatShortDate(emi.nextDueOn);
  if (emi.overdue) return `Overdue · was due ${on}`;
  if (emi.paidThisMonth) return `Paid this month · next ${on}`;
  return `Due ${on}`;
}

export default function EmiList({ emis }: { emis: EmiSummary[] }) {
  const running = emis.filter((e) => e.remaining > 0);
  const totalDue = running.reduce((s, e) => s + e.remaining, 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[19px] font-bold tracking-[-0.01em]">Your EMIs</h3>
        <AddEmiButton />
      </div>
      {emis.length === 0 ? (
        <p className="mt-6 card px-4 py-10 text-center text-sm text-paper/55">
          No EMIs yet. Add a loan or installment to track what’s left.
        </p>
      ) : (
        <>
          {/* The total is in the tile above; the bar only shows the split */}
          {totalDue > 0 && (
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-paper/10">
              {running.map((e, i) => (
                <motion.div
                  key={e.id}
                  title={`${e.name}: ${formatMoney(e.remaining)} left`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(e.remaining / totalDue) * 100}%` }}
                  transition={{ delay: 0.05 * i, duration: 0.6 }}
                  style={{ background: `var(--cat-${e.color})` }}
                />
              ))}
            </div>
          )}
          <ul className="mt-3 grid items-start gap-2 lg:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {emis.map((emi) => (
                <EmiCard key={emi.id} emi={emi} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </Card>
  );
}

function EmiCard({ emi }: { emi: EmiSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const progress = emi.total_amount > 0 ? emi.paid / emi.total_amount : 0;
  const done = emi.remaining <= 0;
  const due = dueLabel(emi);
  const payments = showAll ? emi.payments : emi.payments.slice(0, RECENT);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-inset border border-paper/10 bg-inset"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="h-12 w-1.5 shrink-0 rounded-full"
          style={{ background: `var(--cat-${emi.color})` }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{emi.name}</span>
          <span className="block truncate text-xs text-paper/60">
            {formatMoney(emi.monthly_amount)} / month · {monthsLabel(emi)}
            {emi.lender ? ` · ${emi.lender}` : ""}
          </span>
          {/* Its own line, so a long name or lender can't push it out of view */}
          {due && (
            <span
              className={`block text-xs ${
                emi.overdue ? "text-red-700 dark:text-red-300" : "text-paper/60"
              }`}
            >
              {due}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {done ? "Paid off" : formatMoney(emi.remaining)}
          </span>
          <span className="block text-xs text-paper/55">
            {done ? formatMoney(emi.paid) : `${formatMoney(emi.paid)} paid`}
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-paper/10"
          >
            <div className="px-4 pt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-paper/10">
                <div
                  className="h-full rounded-full bg-moss"
                  style={{ width: `${Math.min(progress, 1) * 100}%` }}
                />
              </div>
              {/* What's paid is already in the row above */}
              <p className="mt-1.5 text-xs text-paper/60">
                {formatMoney(emi.total_amount)} in all
                {emi.monthsLeft > 0
                  ? ` · ${emi.monthsLeft} ${emi.monthsLeft === 1 ? "month" : "months"} left`
                  : ""}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 px-4 pt-3 text-xs">
              <div>
                <dt className="text-paper/60">Due</dt>
                <dd className="font-medium">{dueDayLabel(emi.due_day)}</dd>
              </div>
              <div>
                <dt className="text-paper/60">Started</dt>
                <dd className="font-medium">{formatShortDate(emi.start_on)}</dd>
              </div>
            </dl>
            {!done && <PayForm emi={emi} />}
            <ul className="px-4 py-2">
              {payments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
              {emi.payments.length === 0 && (
                <li className="py-3 text-sm text-paper/55">No payments yet.</li>
              )}
            </ul>
            {emi.payments.length > RECENT && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="mx-4 flex min-h-10 items-center text-sm font-medium text-ember"
              >
                {showAll ? "Show fewer" : `Show all (${emi.payments.length})`}
              </button>
            )}
            <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${quietButton} hover:bg-paper/5 hover:text-paper`}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${emi.name} and all its payments?`))
                    startTransition(() => deleteEmi(emi.id));
                }}
                className={`${quietButton} hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300`}
              >
                Delete EMI
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={editing} onClose={() => setEditing(false)} title={`Edit ${emi.name}`}>
        <EditEmiForm emi={emi} onSaved={() => setEditing(false)} />
      </Sheet>
    </motion.li>
  );
}

function PaymentRow({ payment }: { payment: EmiPayment }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`group flex items-center gap-3 border-b border-paper/5 py-2.5 text-sm last:border-0 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">Installment</span>
        <span className="block truncate text-xs text-paper/60">
          {formatShortDate(payment.occurred_on)}
          {payment.note ? ` · ${payment.note}` : ""}
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">
        −{formatMoney(payment.amount)}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this payment?"))
            startTransition(() => deleteEmiPayment(payment.id));
        }}
        aria-label="Delete payment"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-paper/45 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
      >
        ×
      </button>
    </li>
  );
}
