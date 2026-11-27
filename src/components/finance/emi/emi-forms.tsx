"use client";

import { useActionState, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addEmi,
  addEmiPayment,
  updateEmi,
  type FormState,
} from "@/app/(dashboard)/financial/emi/actions";
import Sheet from "@/components/ui/sheet";
import type { EmiSummary } from "@/lib/emis";
import { todayISO } from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-inset px-3 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const compactInput =
  "h-10 w-full rounded-xl border border-paper/10 bg-inset px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const initial: FormState = { error: null, ok: false, version: 0 };

export function AddEmiButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-ember px-3.5 text-sm font-medium text-on-ember shadow-sm transition-colors hover:bg-ember-light"
      >
        <span className="text-lg leading-none">+</span>
        New EMI
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="New EMI">
        <AddEmiForm onSaved={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function AddEmiForm({ onSaved }: { onSaved?: () => void }) {
  const [state, action, pending] = useActionState(addEmi, initial);
  const values = state.ok ? undefined : state.values;

  useEffect(() => {
    if (state.ok) onSaved?.();
  }, [state, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-4">
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
        className="h-11 rounded-xl bg-ember font-medium text-on-ember transition hover:bg-ember-light disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add EMI"}
      </button>
    </form>
  );
}

export function EditEmiForm({
  emi,
  onSaved,
}: {
  emi: EmiSummary;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateEmi, initial);
  const values = state.ok ? undefined : state.values;

  useEffect(() => {
    if (state.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={emi.id} />
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Name</span>
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={values?.name ?? emi.name}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Lender</span>
        <input
          name="lender"
          maxLength={60}
          defaultValue={values?.lender ?? emi.lender ?? ""}
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
            defaultValue={values?.monthly_amount ?? String(emi.monthly_amount)}
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
            defaultValue={
              values?.tenure_months ??
              (emi.tenure_months != null ? String(emi.tenure_months) : "")
            }
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
              required
              inputMode="decimal"
              autoComplete="off"
              defaultValue={values?.total_amount ?? String(emi.total_amount)}
              className={`${inputClass} pl-8`}
            />
          </div>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Started on</span>
          <input
            name="start_on"
            type="date"
            required
            defaultValue={values?.start_on ?? emi.start_on}
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
            defaultValue={values?.due_day ?? String(emi.due_day)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Note</span>
        <input
          name="note"
          maxLength={200}
          defaultValue={values?.note ?? emi.note ?? ""}
          placeholder="Optional"
          className={inputClass}
        />
      </label>
      <ErrorBox error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-ember font-medium text-on-ember transition hover:bg-ember-light disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export function PayForm({ emi }: { emi: EmiSummary }) {
  const [state, action, pending] = useActionState(addEmiPayment, initial);
  const suggested = Math.min(emi.monthly_amount, emi.remaining);

  return (
    <form
      key={state.version}
      action={action}
      className="mt-3 flex flex-col gap-2 px-4"
    >
      <input type="hidden" name="emi_id" value={emi.id} />
      <span className={labelClass}>Log a payment</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/40">
          ₹
        </span>
        <input
          name="amount"
          required
          inputMode="decimal"
          autoComplete="off"
          defaultValue={
            state.ok ? String(suggested) : (state.values?.amount ?? String(suggested))
          }
          className={`${compactInput} pl-7`}
          aria-label="Payment amount"
        />
      </div>
      <div className="flex gap-2">
        <input
          name="occurred_on"
          type="date"
          required
          defaultValue={state.values?.occurred_on || todayISO()}
          className={`${compactInput} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-xl bg-ember px-4 text-sm font-medium text-on-ember disabled:opacity-60"
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
