"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FormState } from "@/app/(dashboard)/financial/actions";
import {
  addAccount,
  addInvestmentEntry,
} from "@/app/(dashboard)/financial/savings/actions";
import {
  ACCOUNT_KINDS,
  type Account,
  type InvestmentKind,
} from "@/lib/investments";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const ENTRY_KINDS: { kind: InvestmentKind; label: string; hint: string }[] = [
  { kind: "deposit", label: "Put in", hint: "Money you saved or invested." },
  { kind: "withdrawal", label: "Take out", hint: "Money you took out." },
  {
    kind: "value",
    label: "Update value",
    hint: "What the account is worth today (for returns).",
  },
];

const initial: FormState = { error: null, ok: false, version: 0 };

export function InvestmentEntryForm({
  accounts,
  defaultDate,
}: {
  accounts: Account[];
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(addInvestmentEntry, initial);
  const [kind, setKind] = useState<InvestmentKind>("deposit");
  const [dismissed, setDismissed] = useState(0);
  const showSaved = state.ok && dismissed !== state.version;
  const values = state.ok ? undefined : state.values;
  const meta = ENTRY_KINDS.find((k) => k.kind === kind)!;

  useEffect(() => {
    if (!state.ok) return;
    const t = window.setTimeout(() => setDismissed(state.version), 1800);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">Add an entry</h3>
          <p className="mt-0.5 text-sm text-paper/50">{meta.hint}</p>
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

      {accounts.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-paper/10 px-4 py-8 text-center text-sm text-paper/45">
          Add an account below first, like an FD, SIP or savings account.
        </p>
      ) : (
        <form
          key={state.version}
          action={action}
          className="mt-5 flex flex-col gap-4"
        >
          <input type="hidden" name="kind" value={kind} />

          <div
            role="radiogroup"
            aria-label="What happened"
            className="grid grid-cols-3 gap-1 rounded-xl border border-paper/10 bg-ink/40 p-1"
          >
            {ENTRY_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={kind === k.kind}
                onClick={() => setKind(k.kind)}
                className={`relative h-9 rounded-lg text-sm font-medium transition-colors ${
                  kind === k.kind
                    ? "text-paper"
                    : "text-paper/50 hover:text-paper"
                }`}
              >
                {kind === k.kind && (
                  <motion.span
                    layoutId="investment-kind-pill"
                    className="absolute inset-0 rounded-lg border border-paper/10 bg-surface shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{k.label}</span>
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Account</span>
            <select
              name="account_id"
              required
              defaultValue={values?.account_id ?? accounts[0]?.id}
              className={inputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>
              {kind === "value" ? "Current value" : "Amount"}
            </span>
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

          <ErrorBox error={state.error} />

          <motion.button
            type="submit"
            disabled={pending}
            whileTap={{ scale: 0.98 }}
            className="h-12 rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Saving…" : "Save entry"}
          </motion.button>
        </form>
      )}
    </section>
  );
}

export function AddAccountForm({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState(addAccount, initial);

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-serif text-2xl">New account</h3>
          <p className="mt-0.5 text-sm text-paper/50">
            FD, mutual fund, stocks, PPF, gold…
          </p>
        </div>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-lg text-paper/60"
        >
          +
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            key={state.ok ? state.version : "draft"}
            action={action}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 pt-5">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Name</span>
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={state.ok ? "" : state.values?.name}
                  placeholder="SBI FD, Nifty 50 SIP…"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Type</span>
                <select
                  name="kind"
                  defaultValue={state.ok ? "fd" : (state.values?.kind ?? "fd")}
                  className={inputClass}
                >
                  {ACCOUNT_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Already in it</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
                    ₹
                  </span>
                  <input
                    name="opening"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={state.ok ? "" : state.values?.opening}
                    placeholder="Optional starting amount"
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </label>
              <ErrorBox error={state.error} />
              <button
                type="submit"
                disabled={pending}
                className="h-11 rounded-xl border border-paper/15 font-medium transition hover:bg-paper/5 disabled:opacity-60"
              >
                {pending ? "Adding…" : "Add account"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
