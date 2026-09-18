"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteTransaction,
  updateTransaction,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import { BankPicker, Segmented, type BankOption } from "@/components/finance/entry-dialog";
import type { Category, Transaction, TxType } from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink px-3 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass = "text-xs font-medium uppercase tracking-wider text-paper/50";
const badText = "text-red-700 dark:text-red-300";
const initial: FormState = { error: null, ok: false, version: 0 };

// Change an income or expense entry after it was logged.
export default function EditEntry({
  tx,
  categories,
  bankAccounts,
  onDone,
}: {
  tx: Transaction;
  categories: Category[];
  bankAccounts: BankOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(updateTransaction, initial);
  const [deleting, startDelete] = useTransition();
  const [type, setType] = useState<TxType>(tx.type);
  const [categoryId, setCategoryId] = useState(tx.category?.id ?? "");
  // An account deleted since keeps showing as "None"
  const [bankId, setBankId] = useState(
    bankAccounts.some((a) => a.id === tx.bank_account?.id) ? tx.bank_account!.id : "",
  );
  const values = state.ok ? undefined : state.values;
  const shown = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={tx.id} />
      <input type="hidden" name="type" value={type} />
      <Segmented
        label="Entry type"
        value={type}
        onChange={(next) => {
          setType(next);
          // Categories belong to one type; drop one that no longer fits
          if (!categories.some((c) => c.id === categoryId && c.type === next)) setCategoryId("");
        }}
        options={[
          { value: "expense", label: "Expense", dot: "bg-chart-expense" },
          { value: "income", label: "Income", dot: "bg-chart-income" },
        ]}
      />
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Amount</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
            ₹
          </span>
          <input
            name="amount"
            required
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values?.amount ?? String(tx.amount)}
            className={`${inputClass} pl-8 text-lg font-semibold tabular-nums`}
          />
        </div>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Category</span>
          <select
            name="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">No category</option>
            {shown.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Date</span>
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={values?.occurred_on ?? tx.occurred_on}
            className={inputClass}
          />
        </label>
      </div>
      <BankPicker accounts={bankAccounts} type={type} value={bankId} onChange={setBankId} />
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Description</span>
        <input
          name="description"
          maxLength={200}
          defaultValue={values?.description ?? tx.description ?? ""}
          placeholder={type === "expense" ? "Lunch" : "Salary"}
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
            className={`overflow-hidden rounded-lg bg-red-500/10 px-3 py-2 text-sm ${badText}`}
          >
            {state.error}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (confirm("Delete this entry?"))
              startDelete(async () => {
                await deleteTransaction(tx.id);
                onDone();
              });
          }}
          className={`h-11 rounded-xl px-4 text-sm font-medium transition hover:bg-red-500/10 disabled:opacity-60 ${badText}`}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-ember text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
