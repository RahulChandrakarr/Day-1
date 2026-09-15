"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addTransaction,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import { addDebt } from "@/app/(dashboard)/financial/borrow/actions";
import { addInvestmentEntry } from "@/app/(dashboard)/financial/savings/actions";
import type { PlanPerson } from "@/components/finance/budget/budget-editor";
import type { DebtKind } from "@/lib/debts";
import {
  formatMoney,
  type Category,
  type TxPeriod,
  type TxType,
} from "@/lib/finance";
import type { Account } from "@/lib/investments";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const initialState: FormState = { error: null, ok: false, version: 0 };

type Mode = TxType | "savings";

const titles: Record<TxPeriod, string> = {
  daily: "Add an entry",
  monthly: "Add a monthly entry",
  yearly: "Add a yearly entry",
};

const hints: Record<Mode, string> = {
  expense: "Day-to-day spending.",
  income: "Salary, freelance, gifts…",
  savings: "Money put into or taken out of savings.",
};

const periodHints: Record<TxPeriod, string> = {
  daily: "",
  monthly: "Rent, salary, subscriptions, EMIs…",
  yearly: "Insurance, fees, annual bonuses…",
};

// Borrow choices shown as extra chips: money out under Expense, money in under Income
const BORROW_CHIPS: Record<TxType, { kind: DebtKind; label: string; hint: string }[]> = {
  expense: [
    { kind: "repaid", label: "I returned", hint: "You paid back money you had taken." },
    { kind: "lent", label: "I gave", hint: "You gave someone money they'll return." },
  ],
  income: [
    { kind: "borrowed", label: "I took", hint: "Someone gave you money you'll pay back." },
    { kind: "received", label: "I got back", hint: "Someone paid you back." },
  ],
};

export default function TransactionForm({
  categories,
  period,
  defaultDate,
  minDate,
  maxDate,
  people,
  accounts,
}: {
  categories: Category[];
  period: TxPeriod;
  defaultDate: string;
  minDate?: string;
  maxDate?: string;
  // Given on the Daily tab to also log borrow and savings entries
  people?: PlanPerson[];
  accounts?: Account[];
}) {
  const [mode, setMode] = useState<Mode>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [borrowKind, setBorrowKind] = useState<DebtKind | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [dismissed, setDismissed] = useState(0);
  const showSaved = savedCount > 0 && dismissed !== savedCount;

  useEffect(() => {
    if (!savedCount) return;
    const t = window.setTimeout(() => setDismissed(savedCount), 1800);
    return () => window.clearTimeout(t);
  }, [savedCount]);

  const extended = Boolean(people && accounts);
  const modes: Mode[] = extended
    ? ["expense", "income", "savings"]
    : ["expense", "income"];
  const onSaved = () => {
    setSavedCount((n) => n + 1);
    setCategoryId("");
  };
  const dateProps = { defaultDate, minDate, maxDate };
  const txType: TxType = mode === "income" ? "income" : "expense";
  const borrowChip =
    mode !== "savings" && borrowKind
      ? BORROW_CHIPS[txType].find((c) => c.kind === borrowKind)
      : undefined;
  const options = categories.filter((c) => c.type === txType);

  const chipClass = (selected: boolean) =>
    `flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${
      selected
        ? "border-paper/40 bg-paper/10 text-paper"
        : "border-paper/10 text-paper/70 hover:bg-paper/5"
    }`;

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">{titles[period]}</h3>
          <p className="mt-0.5 text-sm text-paper/50">
            {period !== "daily"
              ? periodHints[period]
              : borrowChip
                ? borrowChip.hint
                : hints[mode]}
          </p>
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

      <div className="mt-5">
        <Segmented
          id={`entry-mode-${period}`}
          label="Entry type"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setCategoryId("");
            setBorrowKind(null);
          }}
          options={modes.map((m) => ({
            value: m,
            label: m.charAt(0).toUpperCase() + m.slice(1),
            dot:
              m === "income"
                ? "bg-chart-income"
                : m === "expense"
                  ? "bg-chart-expense"
                  : "bg-moss",
          }))}
          columns={modes.length === 3 ? "grid-cols-3" : "grid-cols-2"}
        />
      </div>

      {mode !== "savings" && (
        <fieldset className="mt-4 flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>Category</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={!borrowKind && categoryId === c.id}
                onClick={() => {
                  setBorrowKind(null);
                  setCategoryId(categoryId === c.id ? "" : c.id);
                }}
                className={chipClass(!borrowKind && categoryId === c.id)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: `var(--cat-${c.color})` }}
                />
                {c.name}
              </button>
            ))}
            {options.length === 0 && (
              <p className="text-sm text-paper/40">No {txType} categories yet.</p>
            )}
            <a
              href="#categories"
              className="flex h-9 items-center rounded-full border border-dashed border-paper/20 px-3 text-sm text-paper/50 transition hover:text-paper"
            >
              + Manage
            </a>
          </div>
          {extended && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-paper/40">Borrow</span>
              {BORROW_CHIPS[txType].map((c) => (
                <button
                  key={c.kind}
                  type="button"
                  aria-pressed={borrowKind === c.kind}
                  onClick={() =>
                    setBorrowKind(borrowKind === c.kind ? null : c.kind)
                  }
                  className={chipClass(borrowKind === c.kind)}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-ember" />
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {mode === "savings" && accounts ? (
        <SavingsFields accounts={accounts} onSaved={onSaved} {...dateProps} />
      ) : borrowChip && people ? (
        <BorrowFields
          key={borrowChip.kind}
          kind={borrowChip.kind}
          people={people}
          onSaved={onSaved}
          {...dateProps}
        />
      ) : (
        <TransactionFields
          key={mode}
          type={txType}
          categoryId={categoryId}
          period={period}
          onSaved={onSaved}
          {...dateProps}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Expense / income
// ---------------------------------------------------------------------------
function TransactionFields({
  type,
  categoryId,
  period,
  onSaved,
  defaultDate,
  minDate,
  maxDate,
}: {
  type: TxType;
  categoryId: string;
  period: TxPeriod;
  onSaved: () => void;
  defaultDate: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [state, action, pending] = useActionState(addTransaction, initialState);
  const amountRef = useSavedEffect(state, onSaved);
  const values = state.ok ? undefined : state.values;

  return (
    <form key={state.version} action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="category_id" value={categoryId} />

      <AmountField inputRef={amountRef} defaultValue={values?.amount} />

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Description</span>
        <input
          name="description"
          maxLength={200}
          defaultValue={values?.description}
          placeholder={type === "expense" ? "Lunch with team" : "September salary"}
          className={inputClass}
        />
      </label>

      <DateField
        defaultValue={values?.occurred_on || defaultDate}
        min={minDate}
        max={maxDate}
      />

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>Add {type}</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Borrow: I returned / I gave / I took / I got back
// ---------------------------------------------------------------------------
function BorrowFields({
  kind,
  people,
  onSaved,
  defaultDate,
  minDate,
  maxDate,
}: {
  kind: DebtKind;
  people: PlanPerson[];
  onSaved: () => void;
  defaultDate: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [state, action, pending] = useActionState(addDebt, initialState);
  const [person, setPerson] = useState("");
  const [inBalance, setInBalance] = useState<"" | "yes" | "no">("");
  const amountRef = useSavedEffect(state, () => {
    setPerson("");
    setInBalance("");
    onSaved();
  });
  const listId = useId();
  const values = state.ok ? undefined : state.values;

  // Most relevant people first: who you owe when returning, who owes you when collecting
  const ranked = [...people].sort((a, b) =>
    kind === "repaid"
      ? b.owe - a.owe
      : kind === "received"
        ? b.owed - a.owed
        : a.name.localeCompare(b.name),
  );
  const match = people.find(
    (p) => p.name.toLowerCase() === person.trim().toLowerCase(),
  );
  const balance = (p: PlanPerson) =>
    p.owe > 0
      ? `you owe ${formatMoney(p.owe)}`
      : p.owed > 0
        ? `owes you ${formatMoney(p.owed)}`
        : "settled";

  return (
    <form key={state.version} action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="in_balance" value={inBalance} />

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>
          {kind === "borrowed" || kind === "received" ? "From" : "To"}
        </span>
        <input
          name="person"
          list={listId}
          required
          maxLength={60}
          autoComplete="off"
          defaultValue={values?.person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="Name"
          className={inputClass}
        />
        <datalist id={listId}>
          {ranked.map((p) => (
            <option key={p.id} value={p.name} label={balance(p)} />
          ))}
        </datalist>
        {match && (
          <span className="text-xs text-paper/50">
            {match.name}: {balance(match)}
            {(kind === "repaid" || kind === "received") &&
              " · counts toward this month's plan"}
          </span>
        )}
      </label>

      <AmountField inputRef={amountRef} defaultValue={values?.amount} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <DateField
          defaultValue={values?.occurred_on || defaultDate}
          min={minDate}
          max={maxDate}
        />
        <NoteField defaultValue={values?.note} />
      </div>

      <BalanceChoice value={inBalance} onChange={setInBalance} />

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>Save</SubmitButton>
    </form>
  );
}

// Asked on every borrow entry: does this money count in the net balance?
export function BalanceChoice({
  value,
  onChange,
}: {
  value: "" | "yes" | "no";
  onChange: (value: "yes" | "no") => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`${labelClass} mb-1.5`}>Add to net balance?</legend>
      <Segmented
        id="in-balance"
        label="Add to net balance?"
        value={value}
        onChange={(v) => onChange(v as "yes" | "no")}
        options={[
          { value: "yes", label: "Add" },
          { value: "no", label: "Don't add" },
        ]}
        columns="grid-cols-2"
        small
      />
      <span className="text-xs text-paper/40">
        {value === "yes"
          ? "This money changes the day's net balance."
          : value === "no"
            ? "Kept separate. Only tracked under Borrow."
            : "Pick one before saving."}
      </span>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Savings: put in / take out
// ---------------------------------------------------------------------------
function SavingsFields({
  accounts,
  onSaved,
  defaultDate,
  minDate,
  maxDate,
}: {
  accounts: Account[];
  onSaved: () => void;
  defaultDate: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [state, action, pending] = useActionState(
    addInvestmentEntry,
    initialState,
  );
  const amountRef = useSavedEffect(state, onSaved);
  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const values = state.ok ? undefined : state.values;

  if (accounts.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-paper/10 px-4 py-8 text-center text-sm text-paper/50">
        No savings accounts yet.{" "}
        <Link href="/financial/savings" className="text-ember hover:underline">
          Add one on the Savings tab
        </Link>
        .
      </p>
    );
  }

  return (
    <form key={state.version} action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />

      <Segmented
        id="savings-kind"
        label="What happened"
        value={kind}
        onChange={setKind}
        options={[
          { value: "deposit", label: "Put in" },
          { value: "withdrawal", label: "Take out" },
        ]}
        columns="grid-cols-2"
        small
      />

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Account</span>
        <select
          name="account_id"
          required
          defaultValue={values?.account_id ?? accounts[0].id}
          className={inputClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <AmountField inputRef={amountRef} defaultValue={values?.amount} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <DateField
          defaultValue={values?.occurred_on || defaultDate}
          min={minDate}
          max={maxDate}
        />
        <NoteField defaultValue={values?.note} />
      </div>

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>
        {kind === "deposit" ? "Put into savings" : "Take out"}
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

// Tells the parent about each successful save and refocuses the amount.
function useSavedEffect(state: FormState, onSaved: () => void) {
  const amountRef = useRef<HTMLInputElement>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });
  useEffect(() => {
    if (!state.ok) return;
    onSavedRef.current();
    amountRef.current?.focus();
  }, [state]);
  return amountRef;
}

function Segmented<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  columns,
  small,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; dot?: string }[];
  columns: string;
  small?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid gap-1 rounded-xl border border-paper/10 bg-ink/40 p-1 ${columns}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative rounded-lg font-medium transition-colors ${
            small ? "h-8 text-xs sm:text-sm" : "h-9 text-sm"
          } ${value === o.value ? "text-paper" : "text-paper/50 hover:text-paper"}`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`pill-${id}`}
              className="absolute inset-0 rounded-lg border border-paper/10 bg-surface shadow-sm"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative flex items-center justify-center gap-2">
            {o.dot && <span className={`h-2 w-2 rounded-full ${o.dot}`} />}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function AmountField({
  inputRef,
  defaultValue,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>Amount</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-paper/40">
          ₹
        </span>
        <input
          ref={inputRef}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          defaultValue={defaultValue}
          placeholder="0"
          className={`${inputClass} h-14 pl-9 text-2xl font-semibold`}
        />
      </div>
    </label>
  );
}

function DateField({
  defaultValue,
  min,
  max,
}: {
  defaultValue: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>Date</span>
      <input
        type="date"
        name="occurred_on"
        required
        defaultValue={defaultValue}
        min={min}
        max={max}
        className={inputClass}
      />
    </label>
  );
}

function NoteField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>Note</span>
      <input
        name="note"
        maxLength={200}
        defaultValue={defaultValue}
        placeholder="Optional"
        className={inputClass}
      />
    </label>
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

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="submit"
      disabled={pending}
      whileTap={{ scale: 0.98 }}
      className="h-12 rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Saving…" : children}
    </motion.button>
  );
}
