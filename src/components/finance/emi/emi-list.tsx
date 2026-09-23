"use client";

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addEmiPayment,
  deleteEmi,
  deleteEmiPayment,
  type FormState,
} from "@/app/(dashboard)/financial/emi/actions";
import { dueDayLabel, type EmiPayment, type EmiSummary } from "@/lib/emis";
import { formatMoney, formatShortDate, todayISO } from "@/lib/finance";

const initial: FormState = { error: null, ok: false, version: 0 };
const inputClass =
  "h-10 w-full rounded-xl border border-paper/10 bg-ink px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

export default function EmiList({ emis }: { emis: EmiSummary[] }) {
  const running = emis.filter((e) => e.remaining > 0);
  const totalDue = running.reduce((s, e) => s + e.remaining, 0);

  return (
    <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <h3 className="font-serif text-2xl">Your EMIs</h3>
      {emis.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-dashed border-paper/10 px-4 py-10 text-center text-sm text-paper/40">
          No EMIs yet. Add a loan or installment to track what’s left.
        </p>
      ) : (
        <>
          {totalDue > 0 && (
            <div className="mt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-paper/10">
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
              <p className="mt-1.5 text-xs text-paper/45">
                {formatMoney(totalDue)} still to pay
              </p>
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {emis.map((emi) => (
                <EmiCard key={emi.id} emi={emi} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </section>
  );
}

function EmiCard({ emi }: { emi: EmiSummary }) {
  const [expanded, setExpanded] = useState(emi.remaining > 0);
  const [pending, startTransition] = useTransition();
  const progress = emi.total_amount > 0 ? emi.paid / emi.total_amount : 0;
  const done = emi.remaining <= 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-2xl border border-paper/10 bg-ink"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: `var(--cat-${emi.color})` }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{emi.name}</span>
          <span className="block truncate text-xs text-paper/45">
            {emi.lender ? `${emi.lender} · ` : ""}
            {formatMoney(emi.monthly_amount)} / month
            {done
              ? " · paid off"
              : emi.overdue
                ? " · overdue"
                : emi.paidThisMonth
                  ? " · paid this month"
                  : emi.nextDueOn
                    ? ` · due ${formatShortDate(emi.nextDueOn)}`
                    : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {done ? "Paid off" : formatMoney(emi.remaining)}
          </span>
          <span className="block text-xs text-paper/40">
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
              <p className="mt-1.5 text-xs text-paper/45">
                {formatMoney(emi.paid)} of {formatMoney(emi.total_amount)}
                {emi.monthsLeft > 0
                  ? ` · about ${emi.monthsLeft} ${emi.monthsLeft === 1 ? "month" : "months"} left`
                  : ""}
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3 px-4 pt-3 text-xs">
              <div>
                <dt className="text-paper/45">Monthly</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(emi.monthly_amount)}
                </dd>
              </div>
              <div>
                <dt className="text-paper/45">Due</dt>
                <dd className="font-medium">{dueDayLabel(emi.due_day)}</dd>
              </div>
              <div>
                <dt className="text-paper/45">Started</dt>
                <dd className="font-medium">{formatShortDate(emi.start_on)}</dd>
              </div>
            </dl>
            {!done && <PayForm emi={emi} />}
            <ul className="px-4 py-2">
              {emi.payments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
              {emi.payments.length === 0 && (
                <li className="py-3 text-sm text-paper/40">No payments yet.</li>
              )}
            </ul>
            <div className="flex justify-end px-4 pb-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${emi.name} and all its payments?`))
                    startTransition(() => deleteEmi(emi.id));
                }}
                className="rounded-lg px-2 py-1 text-xs text-paper/40 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                Delete EMI
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function PayForm({ emi }: { emi: EmiSummary }) {
  const [state, action, pending] = useActionState(addEmiPayment, initial);
  const suggested = Math.min(emi.monthly_amount, emi.remaining);

  return (
    <form
      key={state.version}
      action={action}
      className="mt-3 flex flex-col gap-2 px-4"
    >
      <input type="hidden" name="emi_id" value={emi.id} />
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/40">
            ₹
          </span>
          <input
            name="amount"
            required
            inputMode="decimal"
            autoComplete="off"
            defaultValue={state.ok ? String(suggested) : (state.values?.amount ?? String(suggested))}
            className={`${inputClass} pl-7`}
            aria-label="Payment amount"
          />
        </div>
        <input
          name="occurred_on"
          type="date"
          required
          defaultValue={state.values?.occurred_on || todayISO()}
          className={`${inputClass} w-[9.5rem] shrink-0`}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-xl bg-ember px-3 text-sm font-medium text-on-ember disabled:opacity-60"
        >
          {pending ? "…" : "Pay"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
    </form>
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
        <span className="block truncate text-xs text-paper/45">
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
      >
        ×
      </button>
    </li>
  );
}
