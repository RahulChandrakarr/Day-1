"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addTransaction,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import type { Category, TxPeriod, TxType } from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

const titles: Record<TxPeriod, string> = {
  daily: "Add an entry",
  monthly: "Add a monthly entry",
  yearly: "Add a yearly entry",
};

const hints: Record<TxPeriod, string> = {
  daily: "Day-to-day spending and income.",
  monthly: "Rent, salary, subscriptions, EMIs…",
  yearly: "Insurance, fees, annual bonuses…",
};

export default function TransactionForm({
  categories,
  period,
  defaultDate,
  minDate,
  maxDate,
}: {
  categories: Category[];
  period: TxPeriod;
  defaultDate: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addTransaction,
    { error: null, ok: false, version: 0 },
  );
  const [type, setType] = useState<TxType>("expense");
  const [dismissed, setDismissed] = useState(0);
  const amountRef = useRef<HTMLInputElement>(null);
  const showSaved = state.ok && dismissed !== state.version;

  useEffect(() => {
    if (!state.ok) return;
    amountRef.current?.focus();
    const t = window.setTimeout(() => setDismissed(state.version), 1800);
    return () => window.clearTimeout(t);
  }, [state]);

  const values = state.ok ? undefined : state.values;
  const options = categories.filter((c) => c.type === type);

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">{titles[period]}</h3>
          <p className="mt-0.5 text-sm text-paper/50">{hints[period]}</p>
        </div>
        <AnimatePresence>
          {showSaved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-moss/15 px-3 py-1 text-xs font-medium text-moss"
              role="status"
            >
              Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Remount on each submit so defaults reflect the last attempt */}
      <form
        key={state.version}
        action={action}
        className="mt-5 flex flex-col gap-4"
      >
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="period" value={period} />

        <div
          role="radiogroup"
          aria-label="Entry type"
          className="grid grid-cols-2 gap-1 rounded-xl border border-paper/10 bg-ink/40 p-1"
        >
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={`relative h-9 rounded-lg text-sm font-medium capitalize transition-colors ${
                type === t ? "text-paper" : "text-paper/50 hover:text-paper"
              }`}
            >
              {type === t && (
                <motion.span
                  layoutId={`type-pill-${period}`}
                  className="absolute inset-0 rounded-lg border border-paper/10 bg-surface shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    t === "income" ? "bg-chart-income" : "bg-chart-expense"
                  }`}
                />
                {t}
              </span>
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-paper/50">
            Amount
          </span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-paper/40">
              ₹
            </span>
            <input
              ref={amountRef}
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              required
              defaultValue={values?.amount}
              placeholder="0"
              className={`${inputClass} h-14 pl-9 text-2xl font-semibold`}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-paper/50">
            Description
          </span>
          <input
            name="description"
            maxLength={200}
            defaultValue={values?.description}
            placeholder={
              type === "expense" ? "Lunch with team" : "September salary"
            }
            className={inputClass}
          />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wider text-paper/50">
            Category
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="category_id"
                  value={c.id}
                  defaultChecked={values?.category_id === c.id}
                  className="peer sr-only"
                />
                <span className="flex h-9 items-center gap-2 rounded-full border border-paper/10 px-3 text-sm text-paper/70 transition peer-checked:border-paper/40 peer-checked:bg-paper/10 peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-ember/50 hover:bg-paper/5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: `var(--cat-${c.color})` }}
                  />
                  {c.name}
                </span>
              </label>
            ))}
            {options.length === 0 && (
              <p className="text-sm text-paper/40">No {type} categories yet.</p>
            )}
            <a
              href="#categories"
              className="flex h-9 items-center rounded-full border border-dashed border-paper/20 px-3 text-sm text-paper/50 transition hover:text-paper"
            >
              + Manage
            </a>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-paper/50">
            Date
          </span>
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={values?.occurred_on || defaultDate}
            min={minDate}
            max={maxDate}
            className={inputClass}
          />
        </label>

        <AnimatePresence>
          {state.error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
            >
              {state.error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          className="h-12 rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Saving…" : `Add ${type}`}
        </motion.button>
      </form>
    </section>
  );
}
