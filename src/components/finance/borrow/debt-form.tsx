"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addDebt } from "@/app/(dashboard)/financial/borrow/actions";
import type { FormState } from "@/app/(dashboard)/financial/actions";
import { BalanceChoice } from "@/components/finance/transaction-form";
import { DEBT_KINDS, type DebtKind, type Person } from "@/lib/debts";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const hints: Record<DebtKind, string> = {
  borrowed: "Someone gave you money you'll pay back.",
  repaid: "You paid back money you had taken.",
  lent: "You gave someone money they'll return.",
  received: "Someone paid you back.",
};

export default function DebtForm({
  people,
  defaultDate,
}: {
  people: Person[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addDebt,
    { error: null, ok: false, version: 0 },
  );
  const [kind, setKind] = useState<DebtKind>("borrowed");
  // The choice clears after a successful save, but survives validation errors
  const [choice, setChoice] = useState<{
    version: number;
    value: "yes" | "no";
  } | null>(null);
  const inBalance =
    choice && !(state.ok && state.version > choice.version) ? choice.value : "";
  const [dismissed, setDismissed] = useState(0);
  const listId = useId();
  const personRef = useRef<HTMLInputElement>(null);
  const showSaved = state.ok && dismissed !== state.version;
  const values = state.ok ? undefined : state.values;

  useEffect(() => {
    if (!state.ok) return;
    personRef.current?.focus();
    const t = window.setTimeout(() => setDismissed(state.version), 1800);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">Add an entry</h3>
          <p className="mt-0.5 text-sm text-paper/50">{hints[kind]}</p>
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

      <form key={state.version} action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="in_balance" value={inBalance} />

        <div
          role="radiogroup"
          aria-label="What happened"
          className="grid grid-cols-2 gap-1 rounded-xl border border-paper/10 bg-ink/40 p-1"
        >
          {DEBT_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              onClick={() => setKind(k.kind)}
              className={`relative h-9 rounded-lg text-sm font-medium transition-colors ${
                kind === k.kind ? "text-paper" : "text-paper/50 hover:text-paper"
              }`}
            >
              {kind === k.kind && (
                <motion.span
                  layoutId="debt-kind-pill"
                  className="absolute inset-0 rounded-lg border border-paper/10 bg-surface shadow-sm"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{k.label}</span>
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>
            {kind === "borrowed"
              ? "From"
              : kind === "lent"
                ? "To"
                : kind === "repaid"
                  ? "Returned to"
                  : "Got back from"}
          </span>
          <input
            ref={personRef}
            name="person"
            list={listId}
            required
            maxLength={60}
            autoComplete="off"
            defaultValue={values?.person}
            placeholder="Name"
            className={inputClass}
          />
          <datalist id={listId}>
            {people.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Amount</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-paper/40">
              ₹
            </span>
            <input
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              name="occurred_on"
              required
              defaultValue={values?.occurred_on || defaultDate}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Note</span>
            <input
              name="note"
              maxLength={200}
              defaultValue={values?.note}
              placeholder="Optional"
              className={inputClass}
            />
          </label>
        </div>

        <BalanceChoice
          value={inBalance}
          onChange={(value) => setChoice({ version: state.version, value })}
        />

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
          {pending ? "Saving…" : "Save entry"}
        </motion.button>
      </form>
    </section>
  );
}
