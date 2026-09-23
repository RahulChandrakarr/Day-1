"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FormState } from "@/app/(dashboard)/financial/emi/actions";
import { addEmi } from "@/app/(dashboard)/financial/emi/actions";
import { todayISO } from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink px-3 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const initial: FormState = { error: null, ok: false, version: 0 };

export function AddEmiForm({ startOpen }: { startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState(addEmi, initial);
  const values = state.ok ? undefined : state.values;

  return (
    <section className="rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-serif text-2xl">New EMI</h3>
          <p className="mt-0.5 text-sm text-paper/50">
            Home loan, bike, phone — whatever you’re paying down.
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
                  defaultValue={values?.name}
                  placeholder="Home loan, Activa, iPhone…"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Lender</span>
                <input
                  name="lender"
                  maxLength={60}
                  defaultValue={values?.lender}
                  placeholder="SBI, Bajaj, Amazon Pay…"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Monthly EMI</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
                    ₹
                  </span>
                  <input
                    name="monthly_amount"
                    required
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={values?.monthly_amount}
                    placeholder="12,500"
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={labelClass}>Tenure (months)</span>
                  <input
                    name="tenure_months"
                    inputMode="numeric"
                    min={1}
                    max={720}
                    defaultValue={values?.tenure_months}
                    placeholder="36"
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={labelClass}>Total to repay</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
                      ₹
                    </span>
                    <input
                      name="total_amount"
                      inputMode="decimal"
                      autoComplete="off"
                      defaultValue={values?.total_amount}
                      placeholder="If you know it"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </label>
              </div>
              <p className="-mt-2 text-xs text-paper/45">
                Tenure × monthly becomes the total if you leave total blank.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Already paid</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
                    ₹
                  </span>
                  <input
                    name="already_paid"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={values?.already_paid}
                    placeholder="Optional"
                    className={`${inputClass} pl-8`}
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={labelClass}>Started on</span>
                  <input
                    name="start_on"
                    type="date"
                    required
                    defaultValue={values?.start_on || todayISO()}
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={labelClass}>Due day</span>
                  <input
                    name="due_day"
                    type="number"
                    inputMode="numeric"
                    required
                    min={1}
                    max={31}
                    defaultValue={values?.due_day || "5"}
                    placeholder="5"
                    className={inputClass}
                  />
                </label>
              </div>
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
              <ErrorBox error={state.error} />
              <button
                type="submit"
                disabled={pending}
                className="h-11 rounded-xl border border-paper/15 font-medium transition hover:bg-paper/5 disabled:opacity-60"
              >
                {pending ? "Adding…" : "Add EMI"}
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
