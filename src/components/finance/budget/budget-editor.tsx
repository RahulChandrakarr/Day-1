"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addCategory,
  saveBudget,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import {
  formatMoney,
  type Budget,
  type BudgetScope,
  type Category,
} from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const NEW_CATEGORY = "__new__";

type DraftLine = {
  key: string;
  category_id: string;
  amount: string;
  note: string;
};

function toNumber(value: string) {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function draftFrom(budget: Budget | null): DraftLine[] {
  if (!budget || budget.lines.length === 0)
    return [{ key: crypto.randomUUID(), category_id: "", amount: "", note: "" }];
  return budget.lines.map((line) => ({
    key: crypto.randomUUID(),
    category_id: line.category_id,
    amount: String(line.amount),
    note: line.note ?? "",
  }));
}

export default function BudgetEditor({
  scope,
  periodKey,
  categories,
  initial,
  onCancel,
  onSaved,
}: {
  scope: BudgetScope;
  periodKey: string;
  categories: Category[];
  // The plan being edited, or a previous plan to copy from
  initial: Budget | null;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveBudget,
    { error: null, ok: false, version: 0 },
  );
  const [lines, setLines] = useState<DraftLine[]>(() => draftFrom(initial));
  const [income, setIncome] = useState(
    initial?.expected_income != null ? String(initial.expected_income) : "",
  );
  const [savings, setSavings] = useState(
    initial?.savings_target != null ? String(initial.savings_target) : "",
  );

  const expense = categories.filter((c) => c.type === "expense");
  const planned = lines.reduce((sum, l) => sum + toNumber(l.amount), 0);
  const incomeValue = toNumber(income);
  const savingsValue = toNumber(savings);
  const unallocated = incomeValue - planned - savingsValue;

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (state.ok) onSavedRef.current();
  }, [state]);

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: crypto.randomUUID(), category_id: "", amount: "", note: "" },
    ]);
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="period_key" value={periodKey} />
      <input type="hidden" name="expected_income" value={income} />
      <input type="hidden" name="savings_target" value={savings} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map(({ category_id, amount, note }) => ({
            category_id,
            amount,
            note,
          })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          label="Expected income"
          value={income}
          onChange={setIncome}
          placeholder="Salary, freelance…"
        />
        <MoneyField
          label="Savings target"
          value={savings}
          onChange={setSavings}
          placeholder="What you want to keep"
        />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClass} mb-3`}>
          Where the money goes
        </legend>
        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.key}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
            >
              <LineRow
                line={line}
                categories={expense}
                takenIds={lines
                  .filter((l) => l.key !== line.key)
                  .map((l) => l.category_id)}
                onChange={(patch) => update(line.key, patch)}
                onRemove={
                  lines.length > 1
                    ? () =>
                        setLines((prev) =>
                          prev.filter((l) => l.key !== line.key),
                        )
                    : undefined
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          type="button"
          onClick={addLine}
          className="flex h-11 items-center justify-center rounded-xl border border-dashed border-paper/20 text-sm text-paper/60 transition hover:border-paper/40 hover:text-paper"
        >
          + Add line
        </button>
      </fieldset>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-paper/10 bg-ink/40 p-4 text-sm sm:grid-cols-4">
        <Summary label="Income" value={formatMoney(incomeValue)} />
        <Summary label="Planned spend" value={`− ${formatMoney(planned)}`} />
        <Summary label="Savings" value={`− ${formatMoney(savingsValue)}`} />
        <Summary
          label={unallocated < 0 ? "Over by" : "Unallocated"}
          value={formatMoney(Math.abs(unallocated))}
          tone={unallocated < 0 ? "bad" : "good"}
        />
      </div>

      <AnimatePresence>
        {state.error && !state.ok && (
          <motion.p
            key={state.version}
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-xl border border-paper/10 px-5 text-sm font-medium text-paper/70 transition hover:bg-paper/5 hover:text-paper"
          >
            Cancel
          </button>
        )}
        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          className="h-12 rounded-xl bg-ember px-6 font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Saving…" : "Save plan"}
        </motion.button>
      </div>
    </form>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
          ₹
        </span>
        <input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pl-8`}
        />
      </div>
    </label>
  );
}

function LineRow({
  line,
  categories,
  takenIds,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  categories: Category[];
  takenIds: string[];
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = categories.find((c) => c.id === line.category_id);

  function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("type", "expense");
    fd.set("color", String((categories.length % 8) + 1));
    startTransition(async () => {
      const result = await addCategory(
        { error: null, ok: false, version: 0 },
        fd,
      );
      if (result.error || !result.values?.id) {
        setError(result.error ?? "Couldn't add that category.");
        return;
      }
      onChange({ category_id: result.values.id });
      setCreating(false);
      setNewName("");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-paper/10 bg-ink/30 p-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: selected
              ? `var(--cat-${selected.color})`
              : "color-mix(in srgb, var(--paper) 20%, transparent)",
          }}
        />
        {creating ? (
          <input
            autoFocus
            value={newName}
            maxLength={40}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="New category, e.g. Bike servicing"
            aria-label="New category name"
            className={`${inputClass} h-10 flex-1`}
          />
        ) : (
          <select
            value={line.category_id}
            onChange={(e) =>
              e.target.value === NEW_CATEGORY
                ? setCreating(true)
                : onChange({ category_id: e.target.value })
            }
            aria-label="Category"
            className={`${inputClass} h-10 flex-1`}
          >
            <option value="">Choose category…</option>
            {categories.map((c) => (
              <option
                key={c.id}
                value={c.id}
                disabled={takenIds.includes(c.id)}
              >
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        )}
        {creating ? (
          <>
            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="h-10 shrink-0 rounded-xl bg-ember px-3 text-sm font-medium text-on-ember disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              aria-label="Cancel new category"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper/40 transition hover:bg-paper/5 hover:text-paper"
            >
              ×
            </button>
          </>
        ) : (
          onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove line"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
            >
              ×
            </button>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/40">
            ₹
          </span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={line.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0"
            aria-label="Planned amount"
            className={`${inputClass} h-10 pl-7 font-semibold`}
          />
        </div>
        <input
          value={line.note}
          maxLength={80}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Note (optional)"
          aria-label="Note"
          className={`${inputClass} h-10`}
        />
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <p className="text-xs text-paper/45">{label}</p>
      <p
        className={`font-semibold tabular-nums ${
          tone === "bad"
            ? "text-red-700 dark:text-red-300"
            : tone === "good"
              ? "text-moss"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
