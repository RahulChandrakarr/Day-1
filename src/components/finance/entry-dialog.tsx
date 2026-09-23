"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addTransaction,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import { addDebt } from "@/app/(dashboard)/financial/borrow/actions";
import { addEmiPayment } from "@/app/(dashboard)/financial/emi/actions";
import {
  addAccount,
  addInvestmentEntry,
} from "@/app/(dashboard)/financial/savings/actions";
import GymChecklist from "@/components/health/gym-checklist";
import HabitRow from "@/components/health/habit-row";
import { appendJournalNote } from "@/app/(dashboard)/daily/actions";
import type { DebtKind } from "@/lib/debts";
import type { EmiSummary } from "@/lib/emis";
import { streak, type Exercise, type HabitCheckin } from "@/lib/health";
import { MOODS, type Habit } from "@/lib/journal";
import {
  ACCOUNT_KINDS,
  isRecurringKind,
  ordinal,
  sipDate,
  type Account,
  type AccountKind,
  type InvestmentKind,
} from "@/lib/investments";
import {
  formatMoney,
  isValidDate,
  todayISO,
  type BankAccount,
  type Category,
  type TxType,
} from "@/lib/finance";

export type BankOption = Pick<BankAccount, "id" | "name" | "color" | "balance">;

// The account an entry came out of last time, so the next one starts there
const BANK_KEY = "day-one:bank-account";
function lastBankAccount(accounts: BankOption[]) {
  try {
    const saved = localStorage.getItem(BANK_KEY);
    if (saved !== null && (saved === "" || accounts.some((a) => a.id === saved)))
      return saved;
  } catch {}
  return accounts[0]?.id ?? "";
}

export type EntryPerson = {
  id: string;
  name: string;
  owe: number; // you owe them
  owed: number; // they owe you
};

const inputClass =
  "h-10 w-full rounded-xl border border-paper/10 bg-ink px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-paper/50";

const initialState: FormState = { error: null, ok: false, version: 0 };
const FORM_ID = "add-entry-form";

// Borrow choices listed with the categories: money out under Expense, money in under Income
const BORROW_OPTIONS: Record<TxType, { kind: DebtKind; label: string }[]> = {
  expense: [
    { kind: "repaid", label: "I returned money" },
    { kind: "lent", label: "I gave money" },
  ],
  income: [
    { kind: "borrowed", label: "I took money" },
    { kind: "received", label: "I got money back" },
  ],
};

// "+ Add entry" button and the dialog it opens.
type Variant =
  | "entry"
  | "borrow"
  | "savings"
  | "emi"
  | "habit"
  | "journal"
  | "workout";

const VARIANTS: { value: Variant; label: string; title: string }[] = [
  { value: "entry", label: "Money", title: "Add entry" },
  { value: "borrow", label: "Borrow", title: "Borrow entry" },
  { value: "savings", label: "Savings", title: "Savings entry" },
  { value: "emi", label: "EMI", title: "EMI payment" },
  { value: "workout", label: "Workout", title: "Today's workout" },
  { value: "habit", label: "Habits", title: "Habit check-in" },
  { value: "journal", label: "Journal", title: "Quick note" },
];

const titleOf = (variant: Variant) =>
  VARIANTS.find((v) => v.value === variant)?.title ?? "Add entry";

// Which one the page you're on is about
function variantForPath(pathname: string): Variant {
  if (pathname.startsWith("/financial/borrow")) return "borrow";
  if (pathname.startsWith("/financial/savings")) return "savings";
  if (pathname.startsWith("/financial/emi")) return "emi";
  if (pathname.startsWith("/health/gym")) return "workout";
  if (pathname.startsWith("/health/habits")) return "habit";
  if (pathname.startsWith("/daily")) return "journal";
  return "entry";
}

const BORROW_KINDS: { value: DebtKind; label: string }[] = [
  { value: "borrowed", label: "I took" },
  { value: "repaid", label: "I returned" },
  { value: "lent", label: "I gave" },
  { value: "received", label: "Got back" },
];

const SAVINGS_KINDS: { value: InvestmentKind; label: string }[] = [
  { value: "deposit", label: "Put in" },
  { value: "withdrawal", label: "Take out" },
  { value: "value", label: "Update value" },
];

// ?add=1 opens the sheet; ?add=journal opens it on that tab
function addParam(): Variant | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("add");
  if (!value) return null;
  return (VARIANTS.find((v) => v.value === value)?.value ?? "entry") as Variant;
}

export default function EntryDialog({
  categories,
  usage,
  people,
  accounts,
  emis = [],
  bankAccounts = [],
  habits,
  habitCheckins,
  workout,
  compact = false,
}: {
  compact?: boolean;
  categories: Category[];
  usage: Record<string, number>;
  people: EntryPerson[];
  accounts: Account[];
  emis?: Pick<EmiSummary, "id" | "name" | "color" | "monthly_amount" | "remaining">[];
  bankAccounts?: BankOption[];
  habits: Habit[];
  habitCheckins: HabitCheckin[];
  workout: { exercises: Exercise[]; doneIds: string[]; title: string } | null;
}) {
  // ?add=1 comes from the home-screen shortcut and the notification button
  const [open, setOpen] = useState(() => addParam() !== null);
  const [session, setSession] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startVariant = addParam() ?? variantForPath(pathname);

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
        className={
          compact
            ? "flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-ember px-2 text-[15px] font-semibold text-on-ember shadow-sm transition-colors hover:bg-ember-light"
            : "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ember px-6 font-medium text-on-ember shadow-sm transition-colors hover:bg-ember-light md:w-auto md:self-start"
        }
      >
        <span className="text-xl leading-none">+</span>
        {compact ? "Add" : "Add entry"}
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
                  startVariant={startVariant}
                  accounts={accounts}
                  emis={emis}
                  bankAccounts={bankAccounts}
                  categories={categories}
                  usage={usage}
                  people={people}
                  habits={habits}
                  habitCheckins={habitCheckins}
                  workout={workout}
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
  startVariant,
  accounts,
  emis,
  bankAccounts,
  categories,
  usage,
  people,
  habits,
  habitCheckins,
  workout,
  defaultDate,
  onClose,
}: {
  startVariant: Variant;
  accounts: Account[];
  emis: Pick<EmiSummary, "id" | "name" | "color" | "monthly_amount" | "remaining">[];
  bankAccounts: BankOption[];
  habits: Habit[];
  habitCheckins: HabitCheckin[];
  workout: { exercises: Exercise[]; doneIds: string[]; title: string } | null;
  categories: Category[];
  usage: Record<string, number>;
  people: EntryPerson[];
  defaultDate: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<TxType>("expense");
  // A category id, "borrow:<kind>", or "" for no category
  const [choice, setChoice] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>(startVariant);
  const [debtKind, setDebtKind] = useState<DebtKind>("borrowed");
  const [savingsKind, setSavingsKind] = useState<InvestmentKind>("deposit");
  const borrowKind = choice.startsWith("borrow:")
    ? (choice.slice(7) as DebtKind)
    : null;
  // Saving an entry closes the sheet
  const onSaved = onClose;

  // Done saves whatever is typed, then closes
  function done() {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    const amount = form?.elements.namedItem("amount") as HTMLInputElement | null;
    if (form && amount?.value.trim()) form.requestSubmit();
    else onClose();
  }

  // Most-used categories first
  const sorted = categories
    .filter((c) => c.type === type)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (usage[b.c.id] ?? 0) - (usage[a.c.id] ?? 0) || a.i - b.i)
    .map(({ c }) => c);
  const selected = sorted.find((c) => c.id === choice);

  const choose = (value: string) => {
    setChoice(value);
    setPickerOpen(false);
  };
  const choiceLabel = borrowKind
    ? BORROW_OPTIONS[type].find((o) => o.kind === borrowKind)?.label
    : (selected?.name ?? "No category");
  const dotColor = borrowKind
    ? "var(--ember)"
    : selected
      ? `var(--cat-${selected.color})`
      : "color-mix(in srgb, var(--paper) 20%, transparent)";

  // Drawn inside the dialog; the browser's own dropdown mispositions in the sheet
  const categorySelect = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={labelClass}>Category</span>
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-expanded={pickerOpen}
        aria-haspopup="listbox"
        className={`${inputClass} flex items-center gap-2 text-left ${
          pickerOpen ? "border-ember/70 ring-4 ring-ember/15" : ""
        }`}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        <span className="min-w-0 flex-1 truncate">{choiceLabel}</span>
        <motion.svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
          animate={{ rotate: pickerOpen ? 180 : 0 }}
          className="shrink-0 text-paper/45"
        >
          <path d="M6 9l6 6 6-6" />
        </motion.svg>
      </button>
    </div>
  );

  const option = (value: string, label: string, color: string) => (
    <button
      key={value}
      type="button"
      role="option"
      aria-selected={choice === value}
      onClick={() => choose(value)}
      className={`flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition ${
        choice === value
          ? "border-paper/40 bg-paper/10 text-paper"
          : "border-paper/10 text-paper/70 hover:bg-paper/5"
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );

  const categoryPanel = (
    <AnimatePresence initial={false}>
      {pickerOpen && (
        <motion.div
          role="listbox"
          aria-label="Category"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3 rounded-xl border border-paper/10 bg-ink p-3">
            <div className="flex flex-wrap gap-2">
              {option(
                "",
                "No category",
                "color-mix(in srgb, var(--paper) 25%, transparent)",
              )}
              {sorted.map((c) => option(c.id, c.name, `var(--cat-${c.color})`))}
            </div>
            <div>
              <p className="mb-2 text-xs text-paper/40">Borrow</p>
              <div className="flex flex-wrap gap-2">
                {BORROW_OPTIONS[type].map((o) =>
                  option(`borrow:${o.kind}`, o.label, "var(--ember)"),
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const shared = { onSaved, defaultDate, categorySelect, categoryPanel };
  const tabs = VARIANTS.filter(
    (v) =>
      (v.value !== "workout" || (workout && workout.exercises.length > 0)) &&
      (v.value !== "habit" || habits.length > 0) &&
      (v.value !== "emi" || emis.length > 0 || startVariant === "emi"),
  );

  return (
    <>
      <header className="flex items-center gap-3 border-b border-paper/10 px-4 py-3 sm:px-5">
        <h2 className="flex-1 font-serif text-xl sm:text-2xl">
          {titleOf(variant)}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-paper/50 transition hover:bg-paper/10 hover:text-paper"
        >
          ×
        </button>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-paper/10 px-4 py-2 sm:px-5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={variant === tab.value}
            onClick={() => setVariant(tab.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
              variant === tab.value
                ? "bg-ember text-on-ember"
                : "text-paper/55 hover:text-paper"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {variant === "habit" ? (
          <ul className="flex flex-col gap-2">
            {habits.map((habit) => (
              <li
                key={habit.id}
                className="rounded-[14px] border border-paper/10 bg-ink"
              >
                <ul>
                  <HabitRow
                    habit={habit}
                    date={defaultDate}
                    checkin={
                      habitCheckins.find(
                        (c) =>
                          c.habit_id === habit.id && c.check_date === defaultDate,
                      ) ?? null
                    }
                    streak={streak(
                      habitCheckins.filter((c) => c.habit_id === habit.id),
                      defaultDate,
                    )}
                    first
                  />
                </ul>
              </li>
            ))}
          </ul>
        ) : variant === "workout" && workout ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-paper/55">{workout.title}</p>
            <GymChecklist
              exercises={workout.exercises}
              date={defaultDate}
              doneBefore={workout.doneIds.length}
            />
          </div>
        ) : variant === "journal" ? (
          <JournalNote date={defaultDate} onSaved={onSaved} />
        ) : variant === "borrow" ? (
          <>
            <Segmented
              label="What happened"
              value={debtKind}
              onChange={setDebtKind}
              options={BORROW_KINDS}
            />
            <BorrowFields
              key={debtKind}
              kind={debtKind}
              people={people}
              onSaved={onSaved}
              defaultDate={defaultDate}
            />
          </>
        ) : variant === "savings" ? (
          <>
            <Segmented
              label="What happened"
              value={savingsKind}
              onChange={setSavingsKind}
              options={SAVINGS_KINDS}
            />
            <SavingsFields
              kind={savingsKind}
              accounts={accounts}
              onSaved={onSaved}
              defaultDate={defaultDate}
            />
          </>
        ) : variant === "emi" ? (
          <EmiFields emis={emis} onSaved={onSaved} defaultDate={defaultDate} />
        ) : (
          <>
            <Segmented
              label="Entry type"
              value={type}
              onChange={(t) => {
                setType(t);
                setChoice("");
                setPickerOpen(false);
              }}
              options={[
                { value: "expense", label: "Expense", dot: "bg-chart-expense" },
                { value: "income", label: "Income", dot: "bg-chart-income" },
              ]}
            />
            {borrowKind ? (
              <BorrowFields
                key={borrowKind}
                kind={borrowKind}
                people={people}
                {...shared}
              />
            ) : (
              <TransactionFields
                key={type}
                type={type}
                categoryId={choice}
                bankAccounts={bankAccounts}
                {...shared}
              />
            )}
          </>
        )}
      </div>

      <footer className="border-t border-paper/10 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 sm:px-5">
        <button
          type="button"
          onClick={done}
          className="h-10 w-full rounded-xl border border-paper/15 text-sm font-medium transition hover:bg-paper/5"
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
  categorySelect?: ReactNode;
  categoryPanel?: ReactNode;
};

// ---------------------------------------------------------------------------
// Expense / income
// ---------------------------------------------------------------------------
function TransactionFields({
  type,
  categoryId,
  categorySelect,
  categoryPanel,
  onSaved,
  defaultDate,
  bankAccounts,
}: SharedProps & { type: TxType; categoryId: string; bankAccounts: BankOption[] }) {
  const [state, action, pending] = useActionState(addTransaction, initialState);
  const amountRef = useSavedEffect(state, onSaved);
  const values = state.ok ? undefined : state.values;
  const [bankId, setBankId] = useState(() => lastBankAccount(bankAccounts));

  function chooseBank(id: string) {
    setBankId(id);
    try {
      localStorage.setItem(BANK_KEY, id);
    } catch {}
  }

  return (
    <form
      id={FORM_ID}
      key={state.version}
      action={action}
      className="mt-3 flex flex-col gap-3"
    >
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="period" value="daily" />
      <input type="hidden" name="category_id" value={categoryId} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount}
        pending={pending}
      />
      <ErrorBox error={state.error} />
      <div className="grid grid-cols-2 gap-3">
        {categorySelect}
        <DateField defaultValue={values?.occurred_on || defaultDate} />
      </div>
      {categoryPanel}

      <BankPicker accounts={bankAccounts} type={type} value={bankId} onChange={chooseBank} />

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Description</span>
        <input
          name="description"
          maxLength={200}
          defaultValue={values?.description}
          placeholder={type === "expense" ? "Lunch" : "Salary"}
          className={inputClass}
        />
      </label>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Borrow: I returned / I gave / I took / I got back
// ---------------------------------------------------------------------------
function BorrowFields({
  kind,
  people,
  categorySelect,
  categoryPanel,
  onSaved,
  defaultDate,
}: SharedProps & { kind: DebtKind; people: EntryPerson[] }) {
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
    <form
      id={FORM_ID}
      key={state.version}
      action={action}
      className="mt-3 flex flex-col gap-3"
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="in_balance" value={inBalance} />
      <input type="hidden" name="person" value={person || values?.person || ""} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount}
        pending={pending}
      />
      <ErrorBox error={state.error} />
      <div className="grid grid-cols-2 gap-3">
        {categorySelect ?? <NoteField defaultValue={values?.note} />}
        <DateField defaultValue={values?.occurred_on || defaultDate} />
      </div>
      {categoryPanel}

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

      {categorySelect && <NoteField defaultValue={values?.note} />}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Savings: put in / take out / update value
// ---------------------------------------------------------------------------
function SavingsFields({
  kind,
  accounts,
  onSaved,
  defaultDate,
}: {
  kind: InvestmentKind;
  accounts: Account[];
  onSaved: () => void;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState(
    addInvestmentEntry,
    initialState,
  );
  const amountRef = useSavedEffect(state, onSaved);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const values = state.ok ? undefined : state.values;
  // A just-created account may not be in the list until the page refreshes
  const selectedId = accountId || accounts[0]?.id || "";
  const selected = accounts.find((a) => a.id === selectedId);
  // Money going into a SIP / RD starts from its usual amount and date
  const sip =
    kind === "deposit" && selected?.sip_day
      ? {
          amount: selected.sip_amount ? String(selected.sip_amount) : undefined,
          date: sipDate(selected.sip_day, defaultDate),
        }
      : null;

  if ((accounts.length === 0 && !accountId) || creating) {
    return (
      <NewAccount
        first={accounts.length === 0}
        onCancel={accounts.length ? () => setCreating(false) : undefined}
        onCreated={(id) => {
          setAccountId(id);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <form
      id={FORM_ID}
      key={`${state.version}-${selectedId}-${kind}`}
      action={action}
      className="mt-3 flex flex-col gap-3"
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="account_id" value={selectedId} />

      <AmountRow
        inputRef={amountRef}
        defaultValue={values?.amount ?? sip?.amount}
        pending={pending}
        placeholder={kind === "value" ? "Worth now" : "0"}
      />
      {sip && selected?.sip_day && (
        <p className="-mt-1 text-xs text-paper/50">
          {selected.kind === "rd" ? "RD" : "SIP"} of{" "}
          {selected.sip_amount ? formatMoney(selected.sip_amount) : "—"} on the{" "}
          {ordinal(selected.sip_day)} of every month
        </p>
      )}
      <ErrorBox error={state.error} />

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Account</span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((a) => (
            <Chip
              key={a.id}
              selected={selectedId === a.id}
              color={`var(--cat-${a.color})`}
              onClick={() => setAccountId(a.id)}
            >
              {a.name}
            </Chip>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-9 rounded-full border border-dashed border-paper/20 px-3 text-sm text-paper/55 transition hover:text-paper"
          >
            + New account
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NoteField defaultValue={values?.note} />
        <DateField
          defaultValue={values?.occurred_on || sip?.date || defaultDate}
        />
      </div>
    </form>
  );
}

function EmiFields({
  emis,
  onSaved,
  defaultDate,
}: {
  emis: Pick<EmiSummary, "id" | "name" | "color" | "monthly_amount" | "remaining">[];
  onSaved: () => void;
  defaultDate: string;
}) {
  const open = emis.filter((e) => e.remaining > 0);
  const options = open.length ? open : emis;
  const [emiId, setEmiId] = useState(options[0]?.id ?? "");
  const [state, action, pending] = useActionState(addEmiPayment, initialState);
  const amountRef = useSavedEffect(state, onSaved);
  const selected = options.find((e) => e.id === emiId) ?? options[0];
  const suggested = selected
    ? String(Math.min(selected.monthly_amount, selected.remaining))
    : undefined;

  if (options.length === 0) {
    return (
      <p className="mt-3 text-sm text-paper/55">
        Add an EMI on the EMI page first, then log installments here.
      </p>
    );
  }

  return (
    <form
      id={FORM_ID}
      key={`${state.version}-${selected?.id}`}
      action={action}
      className="mt-3 flex flex-col gap-3"
    >
      <input type="hidden" name="emi_id" value={selected?.id ?? emiId} />
      <AmountRow
        inputRef={amountRef}
        defaultValue={state.ok ? suggested : (state.values?.amount ?? suggested)}
        pending={pending}
      />
      {selected && (
        <p className="-mt-1 text-xs text-paper/50">
          {formatMoney(selected.monthly_amount)} a month ·{" "}
          {formatMoney(selected.remaining)} left
        </p>
      )}
      <ErrorBox error={state.error} />
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>EMI</span>
        <div className="flex flex-wrap gap-2">
          {options.map((e) => (
            <Chip
              key={e.id}
              selected={(selected?.id ?? emiId) === e.id}
              color={`var(--cat-${e.color})`}
              onClick={() => setEmiId(e.id)}
            >
              {e.name}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NoteField defaultValue={state.ok ? undefined : state.values?.note} />
        <DateField
          defaultValue={state.values?.occurred_on || defaultDate}
        />
      </div>
    </form>
  );
}

// Create a savings account without leaving the dialog.
function NewAccount({
  first,
  onCancel,
  onCreated,
}: {
  first: boolean;
  onCancel?: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("savings");
  const [sipDay, setSipDay] = useState("");
  const [sipAmount, setSipAmount] = useState("");
  const recurring = isRecurringKind(kind);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("kind", kind);
    if (recurring) {
      fd.set("sip_day", sipDay);
      fd.set("sip_amount", sipAmount);
    }
    setError(null);
    startTransition(async () => {
      const result = await addAccount(initialState, fd);
      if (result.error || !result.values?.id) {
        setError(result.error ?? "Couldn't add the account.");
        return;
      }
      onCreated(result.values.id);
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-paper/60">
        {first
          ? "First, where does this money go? Add an account, like your savings account, an FD or a SIP."
          : "Add another account."}
      </p>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Account name</span>
        <input
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (name.trim()) create();
            }
          }}
          placeholder="SBI savings, HDFC FD, Nifty SIP…"
          className={inputClass}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Type</span>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_KINDS.map((k) => (
            <Chip
              key={k.kind}
              selected={kind === k.kind}
              onClick={() => setKind(k.kind)}
            >
              {k.label}
            </Chip>
          ))}
        </div>
      </div>
      {recurring && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelClass}>
              {kind === "rd" ? "Monthly amount" : "SIP amount"}
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper/40">
                ₹
              </span>
              <input
                inputMode="decimal"
                autoComplete="off"
                value={sipAmount}
                onChange={(e) => setSipAmount(e.target.value)}
                placeholder="5000"
                className={`${inputClass} pl-7`}
              />
            </div>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={labelClass}>Deduction date</span>
            <DaySelect value={sipDay} onChange={setSipDay} />
          </label>
        </div>
      )}
      <ErrorBox error={error} />
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-paper/15 px-4 text-sm font-medium transition hover:bg-paper/5"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={create}
          className="h-10 flex-1 rounded-xl bg-ember text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add account & continue"}
        </button>
      </div>
    </div>
  );
}

// Day of the month, 1–31.
function DaySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={31}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 2))}
        placeholder="5"
        className={`${inputClass} pr-24`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-paper/40">
        of every month
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journal: a quick note (and today's mood) without leaving the page
// ---------------------------------------------------------------------------
function JournalNote({
  date,
  onSaved,
}: {
  date: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!text.trim() && mood === null) return;
    setError(null);
    startTransition(async () => {
      const result = await appendJournalNote(text, date, mood ?? undefined);
      if (result.ok) {
        setText("");
        onSaved();
      } else setError(result.error);
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={mood === m.value}
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={`flex flex-col items-center gap-1 rounded-2xl border py-2 transition ${
              mood === m.value
                ? "border-ember/60 bg-ember/15"
                : "border-paper/10 hover:bg-paper/5"
            }`}
          >
            <span className="text-2xl">{m.emoji}</span>
            <span className="text-[11px] text-paper/60">{m.label}</span>
          </button>
        ))}
      </div>

      <textarea
        autoFocus
        value={text}
        rows={5}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind? This is added to today's journal."
        className={`${inputClass} h-auto resize-none py-2.5 leading-relaxed`}
      />

      <ErrorBox error={error} />

      <button
        type="button"
        onClick={save}
        disabled={pending || (!text.trim() && mood === null)}
        className="h-12 rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add to journal"}
      </button>
      <p className="text-xs text-paper/40">
        Longer writing, priorities and habits live on the Daily tab.
      </p>
    </div>
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
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-paper/40">
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
          className={`${inputClass} h-12 pl-8 text-xl font-semibold tabular-nums sm:text-2xl`}
        />
      </div>
      <motion.button
        type="submit"
        disabled={pending}
        whileTap={{ scale: 0.97 }}
        className="h-12 shrink-0 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
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

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  id?: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; dot?: string }[];
}) {
  const index = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );

  // The highlight slides inside the track, so it isn't thrown off while the dialog animates
  return (
    <div className="rounded-xl border border-paper/10 bg-ink p-1">
      <div
        role="radiogroup"
        aria-label={label}
        className="relative grid"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <motion.span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-lg border border-paper/10 bg-surface shadow-sm"
          style={{ width: `${100 / options.length}%` }}
          initial={false}
          animate={{ x: `${index * 100}%` }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`relative h-9 rounded-lg text-sm font-medium transition-colors duration-200 ${
              value === o.value ? "text-paper" : "text-paper/50 hover:text-paper"
            }`}
          >
            <span className="flex min-w-0 items-center justify-center gap-2 px-1">
              {o.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${o.dot}`} />}
              <span className="truncate">{o.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Which bank account money came out of / went into: a switch while it fits,
// a dropdown once there are many accounts
export function BankPicker({
  accounts,
  type,
  value,
  onChange,
}: {
  accounts: BankOption[];
  type: TxType;
  value: string;
  onChange: (id: string) => void;
}) {
  if (accounts.length === 0) return null;
  const label = type === "expense" ? "Paid from" : "Received in";
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {accounts.length <= 3 ? (
        <>
          <input type="hidden" name="bank_account_id" value={value} />
          <Segmented
            label={label}
            value={value}
            onChange={onChange}
            options={[
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
              { value: "", label: "None" },
            ]}
          />
        </>
      ) : (
        <select
          name="bank_account_id"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.balance < 0 ? "−" : ""}
              {formatMoney(Math.abs(a.balance))}
            </option>
          ))}
          <option value="">No bank account</option>
        </select>
      )}
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
    <label className="flex min-w-0 flex-col gap-1.5">
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
