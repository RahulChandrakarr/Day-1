"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import type { DebtKind } from "@/lib/debts";
import {
  formatMoney,
  isValidDate,
  todayISO,
  type Category,
  type TxType,
} from "@/lib/finance";
import type { Account, InvestmentKind } from "@/lib/investments";

export type EntryPerson = {
  id: string;
  name: string;
  owe: number; // you owe them
  owed: number; // they owe you
};

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink/60 px-4 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const initialState: FormState = { error: null, ok: false, version: 0 };
const VISIBLE_CATEGORIES = 8;

type Mode = TxType | "savings";

// Borrow choices shown as chips: money out under Expense, money in under Income
const BORROW_CHIPS: Record<TxType, { kind: DebtKind; label: string }[]> = {
  expense: [
    { kind: "repaid", label: "I returned" },
    { kind: "lent", label: "I gave" },
  ],
  income: [
    { kind: "borrowed", label: "I took" },
    { kind: "received", label: "I got back" },
  ],
};

const SAVINGS_KINDS: { kind: InvestmentKind; label: string }[] = [
  { kind: "deposit", label: "Put in" },
  { kind: "withdrawal", label: "Take out" },
  { kind: "value", label: "Update value" },
];

// "+ Add entry" button and the dialog it opens.
export default function EntryDialog({
  categories,
  usage,
  people,
  accounts,
}: {
  categories: Category[];
  usage: Record<string, number>;
  people: EntryPerson[];
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // On a past day in Daily, entries default to that day
  const dateParam = searchParams.get("date");
  const defaultDate =
    pathname.startsWith("/financial/daily") && isValidDate(dateParam)
      ? dateParam
      : todayISO();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ember px-6 font-medium text-on-ember shadow-sm transition-colors hover:bg-ember-light md:w-auto md:self-start"
      >
        <span className="text-xl leading-none">+</span>
        Add entry
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
            />
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
              <motion.div
                key="dialog"
                role="dialog"
                aria-modal="true"
                aria-label="Add entry"
                initial={{ y: "100%", opacity: 0.8 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-paper/10 bg-surface shadow-2xl md:max-w-lg md:rounded-3xl"
              >
                <EntryForm
                  key={session}
                  categories={categories}
                  usage={usage}
                  people={people}
                  accounts={accounts}
                  defaultDate={defaultDate}
                  onClose={() => setOpen(false)}
                />
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function EntryForm({
  categories,
  usage,
  people,
  accounts,
  defaultDate,
  onClose,
}: {
  categories: Category[];
  usage: Record<string, number>;
  people: EntryPerson[];
  accounts: Account[];
  defaultDate: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [borrowKind, setBorrowKind] = useState<DebtKind | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [details, setDetails] = useState(defaultDate !== todayISO());
  const [savedCount, setSavedCount] = useState(0);
  const [dismissed, setDismissed] = useState(0);
  const showSaved = savedCount > 0 && dismissed !== savedCount;

  useEffect(() => {
    if (!savedCount) return;
    const t = window.setTimeout(() => setDismissed(savedCount), 1800);
    return () => window.clearTimeout(t);
  }, [savedCount]);

  const txType: TxType = mode === "income" ? "income" : "expense";
  const onSaved = () => {
    setSavedCount((n) => n + 1);
    setCategoryId("");
  };

  // Most-used categories first; keep the selected one visible
  const sorted = categories
    .filter((c) => c.type === txType)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (usage[b.c.id] ?? 0) - (usage[a.c.id] ?? 0) || a.i - b.i)
    .map(({ c }) => c);
  const visible = showAll
    ? sorted
    : sorted.filter(
        (c, i) => i < VISIBLE_CATEGORIES || c.id === categoryId,
      );
  const hidden = sorted.length - visible.length;

  const categoryChips = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {visible.map((c) => (
          <Chip
            key={c.id}
            selected={!borrowKind && categoryId === c.id}
            color={`var(--cat-${c.color})`}
            onClick={() => {
              setBorrowKind(null);
              setCategoryId(categoryId === c.id ? "" : c.id);
            }}
          >
            {c.name}
          </Chip>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="h-9 rounded-full border border-dashed border-paper/20 px-3 text-sm text-paper/55 hover:text-paper"
          >
            + {hidden} more
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-paper/40">Borrow</span>
        {BORROW_CHIPS[txType].map((c) => (
          <Chip
            key={c.kind}
            selected={borrowKind === c.kind}
            color="var(--ember)"
            onClick={() => setBorrowKind(borrowKind === c.kind ? null : c.kind)}
          >
            {c.label}
          </Chip>
        ))}
      </div>
    </div>
  );

  const shared = {
    onSaved,
    defaultDate,
    details,
    onToggleDetails: () => setDetails((v) => !v),
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-paper/10 px-5 py-4">
        <h2 className="flex-1 font-serif text-2xl">Add entry</h2>
        <AnimatePresence>
          {showSaved && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-moss/15 px-3 py-1 text-xs font-medium text-moss"
              role="status"
            >
              Saved ✓
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-paper/50 transition hover:bg-paper/10 hover:text-paper"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <Segmented
          id="entry-mode"
          label="Entry type"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setCategoryId("");
            setBorrowKind(null);
            setShowAll(false);
          }}
          options={[
            { value: "expense", label: "Expense", dot: "bg-chart-expense" },
            { value: "income", label: "Income", dot: "bg-chart-income" },
            { value: "savings", label: "Savings", dot: "bg-moss" },
          ]}
        />

        {mode === "savings" ? (
          <SavingsFields accounts={accounts} {...shared} />
        ) : borrowKind ? (
          <BorrowFields
            key={borrowKind}
            kind={borrowKind}
            people={people}
            chips={categoryChips}
            {...shared}
          />
        ) : (
          <TransactionFields
            key={mode}
            type={txType}
            categoryId={categoryId}
            chips={categoryChips}
            {...shared}
          />
        )}
      </div>

      <footer className="border-t border-paper/10 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3">
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-full rounded-xl border border-paper/15 text-sm font-medium transition hover:bg-paper/5"
        >
          Done
        </button>
      </footer>
    </>
  );
}

type SharedProps = {
  onSaved: () => void;
  defaultDate: string;
  details: boolean;
  onToggleDetails: () => void;
};

// ---------------------------------------------------------------------------
// Expense / income
// ---------------------------------------------------------------------------
function TransactionFields({
  type,
  categoryId,
  chips,
  onSaved,
  defaultDate,
  details,
  onToggleDetails,
}: SharedProps & { type: TxType; categoryId: string; chips: ReactNode }) {
  const [state, action, pending] = useActionState(addTransaction, initialState);
  const amountRef = useSavedEffect(state, onSaved);
  const values = state.ok ? undefined : state.values;

  return (
    <form key={state.version} action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="period" value="daily" />
      <input type="hidden" name="category_id" value={categoryId} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount}
        pending={pending}
      />
      <ErrorBox error={state.error} />
      {chips}

      <Details open={details} onToggle={onToggleDetails}>
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
        <DateField defaultValue={values?.occurred_on || defaultDate} />
      </Details>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Borrow: I returned / I gave / I took / I got back
// ---------------------------------------------------------------------------
function BorrowFields({
  kind,
  people,
  chips,
  onSaved,
  defaultDate,
  details,
  onToggleDetails,
}: SharedProps & { kind: DebtKind; people: EntryPerson[]; chips: ReactNode }) {
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

  // Who you owe first when returning, who owes you first when collecting
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
  const balance = (p: EntryPerson) =>
    p.owe > 0
      ? `you owe ${formatMoney(p.owe)}`
      : p.owed > 0
        ? `owes you ${formatMoney(p.owed)}`
        : "settled";
  // One-tap names for the people this entry most likely involves
  const quick = ranked
    .filter((p) =>
      kind === "repaid" ? p.owe > 0 : kind === "received" ? p.owed > 0 : true,
    )
    .slice(0, 4);

  return (
    <form key={state.version} action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="in_balance" value={inBalance} />
      <input type="hidden" name="person" value={person || values?.person || ""} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount}
        pending={pending}
      />
      <ErrorBox error={state.error} />
      {chips}

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>
          {kind === "borrowed" || kind === "received" ? "From" : "To"}
        </span>
        <input
          list={listId}
          maxLength={60}
          autoComplete="off"
          value={person || values?.person || ""}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="Name"
          aria-label="Person"
          className={inputClass}
        />
        <datalist id={listId}>
          {ranked.map((p) => (
            <option key={p.id} value={p.name} label={balance(p)} />
          ))}
        </datalist>
        {quick.length > 0 && !match && (
          <div className="flex flex-wrap gap-2">
            {quick.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPerson(p.name)}
                className="rounded-full border border-paper/10 px-3 py-1 text-xs text-paper/70 transition hover:bg-paper/5"
              >
                {p.name} · {balance(p)}
              </button>
            ))}
          </div>
        )}
        {match && (
          <span className="text-xs text-paper/50">
            {match.name}: {balance(match)}
            {(kind === "repaid" || kind === "received") &&
              " · counts toward this month's plan"}
          </span>
        )}
      </div>

      <BalanceChoice value={inBalance} onChange={setInBalance} />

      <Details open={details} onToggle={onToggleDetails}>
        <NoteField defaultValue={values?.note} />
        <DateField defaultValue={values?.occurred_on || defaultDate} />
      </Details>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Savings: put in / take out / update value
// ---------------------------------------------------------------------------
function SavingsFields({
  accounts,
  onSaved,
  defaultDate,
  details,
  onToggleDetails,
}: SharedProps & { accounts: Account[] }) {
  const [state, action, pending] = useActionState(
    addInvestmentEntry,
    initialState,
  );
  const amountRef = useSavedEffect(state, onSaved);
  const [kind, setKind] = useState<InvestmentKind>("deposit");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
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
      <input type="hidden" name="account_id" value={accountId} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount}
        pending={pending}
        placeholder={kind === "value" ? "Worth now" : "0"}
      />
      <ErrorBox error={state.error} />

      <div className="flex flex-wrap gap-2">
        {SAVINGS_KINDS.map((k) => (
          <Chip
            key={k.kind}
            selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
          >
            {k.label}
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Account</span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Chip
              key={a.id}
              selected={accountId === a.id}
              color={`var(--cat-${a.color})`}
              onClick={() => setAccountId(a.id)}
            >
              {a.name}
            </Chip>
          ))}
        </div>
      </div>

      <Details open={details} onToggle={onToggleDetails}>
        <NoteField defaultValue={values?.note} />
        <DateField defaultValue={values?.occurred_on || defaultDate} />
      </Details>
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

function AmountRow({
  inputRef,
  defaultValue,
  pending,
  placeholder = "0",
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  defaultValue?: string;
  pending: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-paper/40">
          ₹
        </span>
        <input
          ref={inputRef}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          required
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label="Amount"
          className={`${inputClass} h-14 pl-10 text-3xl font-semibold tabular-nums`}
        />
      </div>
      <motion.button
        type="submit"
        disabled={pending}
        whileTap={{ scale: 0.97 }}
        className="h-14 shrink-0 rounded-xl bg-ember px-6 font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "…" : "Save"}
      </motion.button>
    </div>
  );
}

function Chip({
  selected,
  color,
  onClick,
  children,
}: {
  selected: boolean;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${
        selected
          ? "border-paper/40 bg-paper/10 text-paper"
          : "border-paper/10 text-paper/70 hover:bg-paper/5"
      }`}
    >
      {color && (
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      )}
      {children}
    </button>
  );
}

// Optional fields: always in the form (so the date is sent), shown on demand.
function Details({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="text-sm text-paper/55 transition hover:text-paper"
      >
        {open ? "Hide details ▴" : "More details (note, date) ▾"}
      </button>
      <div className={open ? "mt-3 grid gap-4 sm:grid-cols-2" : "hidden"}>
        {children}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; dot?: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl border border-paper/10 bg-ink/40 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative h-9 rounded-lg text-sm font-medium transition-colors ${
            value === o.value ? "text-paper" : "text-paper/50 hover:text-paper"
          }`}
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

// Asked on every borrow entry: does this money count in the net balance?
function BalanceChoice({
  value,
  onChange,
}: {
  value: "" | "yes" | "no";
  onChange: (value: "yes" | "no") => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Add to net balance?</span>
      <div className="flex gap-2">
        <Chip selected={value === "yes"} onClick={() => onChange("yes")}>
          Add
        </Chip>
        <Chip selected={value === "no"} onClick={() => onChange("no")}>
          Don&apos;t add
        </Chip>
      </div>
      <span className="text-xs text-paper/40">
        {value === "yes"
          ? "This money changes the day's net balance."
          : value === "no"
            ? "Kept separate, only tracked under Borrow."
            : "Pick one before saving."}
      </span>
    </div>
  );
}

function DateField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>Date</span>
      <input
        type="date"
        name="occurred_on"
        required
        defaultValue={defaultValue}
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
