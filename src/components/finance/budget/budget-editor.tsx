"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  saveBudget,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import {
  formatMoney,
  type Budget,
  type BudgetLineKind,
  type BudgetScope,
  type Category,
} from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

export type PlanPerson = {
  id: string;
  name: string;
  owe: number; // I owe them
  owed: number; // they owe me
};

type DraftLine = {
  key: string;
  kind: BudgetLineKind;
  category_id: string;
  person_id: string;
  // Set while typing a brand-new category name instead of picking one
  new_category: string | null;
  label: string;
  amount: string;
};

const NEW_CATEGORY = "__new__";

const blankLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  kind: "spend",
  category_id: "",
  person_id: "",
  new_category: null,
  label: "",
  amount: "",
});

function toNumber(value: string) {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function draftFrom(budget: Budget | null): DraftLine[] {
  if (!budget || budget.lines.length === 0) return [blankLine()];
  return budget.lines.map((line) => ({
    key: crypto.randomUUID(),
    kind: line.kind,
    category_id: line.category_id ?? "",
    person_id: line.person_id ?? "",
    new_category: null,
    label: line.note ?? "",
    amount: String(line.amount),
  }));
}

export default function BudgetEditor({
  scope,
  periodKey,
  categories,
  people,
  initial,
  onCancel,
  onSaved,
}: {
  scope: BudgetScope;
  periodKey: string;
  categories: Category[];
  people: PlanPerson[];
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
  const lastRowRef = useRef<HTMLDivElement>(null);
  const focusNew = useRef(false);

  const expense = categories.filter((c) => c.type === "expense");
  const sumOf = (kind: BudgetLineKind) =>
    lines
      .filter((l) => l.kind === kind)
      .reduce((sum, l) => sum + toNumber(l.amount), 0);
  const planned = sumOf("spend");
  const toReturn = sumOf("repay");
  const toCollect = sumOf("collect");
  const incomeValue = toNumber(income);
  const savingsValue = toNumber(savings);
  const unallocated =
    incomeValue + toCollect - planned - toReturn - savingsValue;

  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (state.ok) onSavedRef.current();
  }, [state]);

  // Put the cursor in a freshly added row
  useEffect(() => {
    if (!focusNew.current) return;
    focusNew.current = false;
    lastRowRef.current?.querySelector<HTMLElement>("select, input")?.focus();
  }, [lines.length]);

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    focusNew.current = true;
    setLines((prev) => [...prev, blankLine()]);
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
          lines.map((l) => ({
            kind: l.kind,
            category_id:
              l.kind === "spend" && l.new_category === null ? l.category_id : "",
            category_name: l.kind === "spend" ? (l.new_category ?? "") : "",
            person_id: l.kind === "spend" ? "" : l.person_id,
            label: l.label,
            amount: l.amount,
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

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-3`}>Where the money goes</legend>

        <div className="hidden grid-cols-[11rem_minmax(0,1fr)_10rem_2.75rem] gap-2 px-1 text-xs text-paper/40 sm:grid">
          <span>Category / person</span>
          <span>For</span>
          <span>Amount</span>
        </div>

        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={line.key}
              ref={i === lines.length - 1 ? lastRowRef : undefined}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-[minmax(0,1fr)_7.5rem_2.5rem] items-center gap-2 rounded-2xl border border-paper/10 p-2 sm:grid-cols-[11rem_minmax(0,1fr)_10rem_2.75rem] sm:rounded-none sm:border-0 sm:p-0"
            >
              <CategoryField
                line={line}
                categories={expense}
                people={people}
                onChange={(patch) => update(line.key, patch)}
              />
              <input
                value={line.label}
                maxLength={80}
                autoComplete="off"
                onChange={(e) => update(line.key, { label: e.target.value })}
                placeholder={
                  i === 0 ? "Rent" : i === 1 ? "Laptop EMI" : "What it's for"
                }
                aria-label={`Line ${i + 1} description`}
                className={`${inputClass} order-last col-span-3 sm:order-none sm:col-span-1`}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/40">
                  ₹
                </span>
                <input
                  value={line.amount}
                  inputMode="decimal"
                  autoComplete="off"
                  onChange={(e) => update(line.key, { amount: e.target.value })}
                  onKeyDown={(e) => {
                    // Enter on the last amount adds the next row
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (i === lines.length - 1) addLine();
                    }
                  }}
                  placeholder="0"
                  aria-label={`Line ${i + 1} amount`}
                  className={`${inputClass} pl-7 font-semibold tabular-nums`}
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) =>
                    prev.length > 1
                      ? prev.filter((l) => l.key !== line.key)
                      : [blankLine()],
                  )
                }
                aria-label={`Remove line ${i + 1}`}
                className="flex h-11 w-full items-center justify-center rounded-xl text-lg text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          type="button"
          onClick={addLine}
          className="mt-1 flex h-11 items-center justify-center rounded-xl border border-dashed border-paper/20 text-sm text-paper/60 transition hover:border-paper/40 hover:text-paper"
        >
          + Add line
        </button>
      </fieldset>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-paper/10 bg-ink/40 p-4 text-sm sm:grid-cols-4">
        <Summary label="Income" value={formatMoney(incomeValue)} />
        {toCollect > 0 && (
          <Summary label="To collect" value={`+ ${formatMoney(toCollect)}`} />
        )}
        <Summary label="Planned spend" value={`− ${formatMoney(planned)}`} />
        {toReturn > 0 && (
          <Summary label="To return" value={`− ${formatMoney(toReturn)}`} />
        )}
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

function CategoryField({
  line,
  categories,
  people,
  onChange,
}: {
  line: DraftLine;
  categories: Category[];
  people: PlanPerson[];
  onChange: (patch: Partial<DraftLine>) => void;
}) {
  const selected = categories.find((c) => c.id === line.category_id);
  const dotColor =
    line.kind === "repay"
      ? "var(--chart-expense)"
      : line.kind === "collect"
        ? "var(--chart-income)"
        : selected
          ? `var(--cat-${selected.color})`
          : "color-mix(in srgb, var(--paper) 20%, transparent)";
  const dot = (
    <span
      className="pointer-events-none absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
      style={{ background: dotColor }}
    />
  );

  if (line.new_category !== null) {
    return (
      <div className="relative">
        {dot}
        <input
          autoFocus
          value={line.new_category}
          maxLength={40}
          onChange={(e) => onChange({ new_category: e.target.value })}
          onKeyDown={(e) => {
            if (
              e.key === "Escape" ||
              (e.key === "Backspace" && !line.new_category)
            ) {
              e.preventDefault();
              onChange({ new_category: null, category_id: "" });
            }
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="New category"
          aria-label="New category name"
          title="Created when you save. Esc to pick an existing one."
          className={`${inputClass} pl-8`}
        />
      </div>
    );
  }

  const value =
    line.kind === "spend"
      ? line.category_id
      : `${line.kind}:${line.person_id}`;
  // People you owe first for returns; people who owe you first for collections
  const owing = people.filter(
    (p) => p.owe > 0 || (line.kind === "repay" && p.id === line.person_id),
  );
  const owed = people.filter(
    (p) => p.owed > 0 || (line.kind === "collect" && p.id === line.person_id),
  );

  return (
    <div className="relative">
      {dot}
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NEW_CATEGORY)
            onChange({ kind: "spend", new_category: "", category_id: "", person_id: "" });
          else if (v.startsWith("repay:") || v.startsWith("collect:")) {
            const [kind, person_id] = v.split(":");
            onChange({
              kind: kind as BudgetLineKind,
              person_id,
              category_id: "",
            });
          } else onChange({ kind: "spend", category_id: v, person_id: "" });
        }}
        aria-label="Category or person"
        className={`${inputClass} pl-8 ${value ? "" : "text-paper/40"}`}
      >
        <option value="">Choose…</option>
        <optgroup label="Spending">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY}>+ New category…</option>
        </optgroup>
        {owing.length > 0 && (
          <optgroup label="Return money to">
            {owing.map((p) => (
              <option key={p.id} value={`repay:${p.id}`}>
                Return to {p.name}
                {p.owe > 0 ? ` (owe ${formatMoney(p.owe)})` : ""}
              </option>
            ))}
          </optgroup>
        )}
        {owed.length > 0 && (
          <optgroup label="Collect money from">
            {owed.map((p) => (
              <option key={p.id} value={`collect:${p.id}`}>
                Collect from {p.name}
                {p.owed > 0 ? ` (owes ${formatMoney(p.owed)})` : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
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
