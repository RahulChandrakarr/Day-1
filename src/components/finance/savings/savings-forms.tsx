"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FormState } from "@/app/(dashboard)/financial/actions";
import { addAccount } from "@/app/(dashboard)/financial/savings/actions";
import { ACCOUNT_KINDS, isRecurringKind, type AccountKind } from "@/lib/investments";
import { Card } from "@/components/ui/kit";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-inset px-3 text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/65";

const initial: FormState = { error: null, ok: false, version: 0 };

export function AddAccountForm({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [kind, setKind] = useState<AccountKind>("fd");
  const [state, action, pending] = useActionState(addAccount, initial);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-bold tracking-tight text-2xl">New account</h3>
          <p className="mt-0.5 text-sm text-paper/65">
            FD, mutual fund, stocks, PPF, gold…
          </p>
        </div>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-lg text-paper/72"
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
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AccountKind)}
                  className={inputClass}
                >
                  {ACCOUNT_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              {isRecurringKind(kind) && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={labelClass}>
                      {kind === "rd" ? "Monthly amount" : "SIP amount"}
                    </span>
                    <input
                      name="sip_amount"
                      inputMode="decimal"
                      autoComplete="off"
                      defaultValue={state.ok ? "" : state.values?.sip_amount}
                      placeholder="₹ 5000"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={labelClass}>Deduction date</span>
                    <input
                      name="sip_day"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      defaultValue={state.ok ? "" : state.values?.sip_day}
                      placeholder="Day, e.g. 5"
                      className={inputClass}
                    />
                  </label>
                </div>
              )}
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Already in it</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/55">
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
    </Card>
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
