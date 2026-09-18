"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FormState } from "@/app/(dashboard)/financial/actions";
import {
  addTransfer,
  deleteBankAccount,
  saveBankAccount,
} from "@/app/(dashboard)/financial/bank/actions";
import Sheet from "@/components/ui/sheet";
import { formatMoney, formatShortDate, type BankAccount } from "@/lib/finance";

const inputClass =
  "h-11 w-full rounded-xl border border-paper/10 bg-ink px-3 text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";
const labelClass = "text-xs font-medium uppercase tracking-wider text-paper/50";
const badText = "text-red-700 dark:text-red-300";
const initial: FormState = { error: null, ok: false, version: 0 };

export const signedMoney = (n: number) => `${n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`;

const transferIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 10l-4 4 4 4M3 14h13M17 14l4-4-4-4M21 10H8" />
  </svg>
);

// What's in each bank account, with add, edit and move-money.
export default function BankAccounts({
  accounts,
  asOf,
  today,
}: {
  accounts: BankAccount[];
  asOf: string; // the day the balances are for
  today: string;
}) {
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const [moving, setMoving] = useState(false);
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <section className="min-w-0 rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl">Bank accounts</h3>
          {accounts.length > 0 && (
            <p className="mt-0.5 text-sm text-paper/50">
              <span className={total < 0 ? badText : ""}>{signedMoney(total)}</span> in{" "}
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
              {asOf !== today && ` at the end of ${formatShortDate(asOf)}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {accounts.length > 1 && (
            <IconButton label="Move money between accounts" onClick={() => setMoving(true)}>
              {transferIcon}
            </IconButton>
          )}
          <IconButton label="Add bank account" onClick={() => setEditing("new")}>
            <span className="text-xl leading-none">+</span>
          </IconButton>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-paper/10 p-4">
          <p className="text-sm text-paper/55">
            Add SBI, Axis, cash… with what&apos;s in each right now. Entries you log
            come out of the account you pick, and Net balance shows the total.
          </p>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="h-10 rounded-xl bg-ember px-4 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light"
          >
            Add bank account
          </button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-paper/5">
          {accounts.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setEditing(a)}
                aria-label={`Edit ${a.name}, ${signedMoney(a.balance)}`}
                className="flex w-full items-center gap-3 py-3 text-left transition active:opacity-70"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--cat-${a.color})` }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 break-words font-medium">{a.name}</span>
                <span
                  className={`shrink-0 font-semibold tabular-nums ${a.balance < 0 ? badText : ""}`}
                >
                  {signedMoney(a.balance)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add bank account" : editing ? `Edit ${editing.name}` : ""}
      >
        {editing && (
          <AccountForm
            account={editing === "new" ? null : editing}
            // Balances on screen may be for a past day; the form wants today's
            today={today}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>

      <Sheet open={moving} onClose={() => setMoving(false)} title="Move money">
        {moving && (
          <TransferForm accounts={accounts} today={today} onDone={() => setMoving(false)} />
        )}
      </Sheet>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/15 text-paper/70 transition hover:bg-paper/5 hover:text-paper"
    >
      {children}
    </button>
  );
}

function useCloseWhenSaved(state: FormState, onDone: () => void) {
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
}

function AccountForm({
  account,
  today,
  onDone,
}: {
  account: BankAccount | null;
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveBankAccount, initial);
  const [deleting, startDelete] = useTransition();
  useCloseWhenSaved(state, onDone);
  const values = state.ok ? undefined : state.values;

  return (
    <form action={action} className="flex flex-col gap-4">
      {account && <input type="hidden" name="id" value={account.id} />}
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Name</span>
        <input
          name="name"
          required
          maxLength={40}
          autoFocus={!account}
          defaultValue={values?.name ?? account?.name}
          placeholder="SBI, Axis Bank, Cash…"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>In it right now</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-paper/40">
            ₹
          </span>
          <input
            name="balance"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={values?.balance ?? (account ? String(account.balance) : "")}
            placeholder="0"
            className={`${inputClass} pl-8 tabular-nums`}
          />
        </div>
        <span className="text-xs text-paper/45">
          {account
            ? `Your balance on ${formatShortDate(today)}. Entries you've logged stay as they are.`
            : "From now on, entries you log against it add to or take from this."}
        </span>
      </label>
      {!account && (
        <label className="flex items-start gap-3 rounded-xl border border-paper/10 p-3">
          <input
            type="checkbox"
            name="as_income"
            defaultChecked={values?.as_income === "on"}
            className="mt-0.5 h-5 w-5 shrink-0 accent-ember"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Count it as income this month</span>
            <span className="text-xs text-paper/50">
              Tick this if the money came in this month, so your monthly totals include it.
            </span>
          </span>
        </label>
      )}
      <ErrorBox error={state.error} />
      <div className="flex gap-2">
        {account && (
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (
                confirm(
                  `Delete ${account.name}? Entries logged against it stay, but won't count toward any account.`,
                )
              )
                startDelete(async () => {
                  await deleteBankAccount(account.id);
                  onDone();
                });
            }}
            className={`h-11 rounded-xl px-4 text-sm font-medium transition hover:bg-red-500/10 disabled:opacity-60 ${badText}`}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-ember text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
        >
          {pending ? "Saving…" : account ? "Save" : "Add account"}
        </button>
      </div>
    </form>
  );
}

function TransferForm({
  accounts,
  today,
  onDone,
}: {
  accounts: BankAccount[];
  today: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(addTransfer, initial);
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  useCloseWhenSaved(state, onDone);
  const values = state.ok ? undefined : state.values;

  const pick = (label: string, value: string, set: (id: string) => void, other: string) => (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            disabled={a.id === other}
            onClick={() => set(a.id)}
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition disabled:opacity-35 ${
              value === a.id
                ? "border-paper/40 bg-paper/10 text-paper"
                : "border-paper/10 text-paper/70 hover:bg-paper/5"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--cat-${a.color})` }} />
            {a.name}
            <span className="text-xs text-paper/45 tabular-nums">{signedMoney(a.balance)}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      {pick("From", from, setFrom, to)}
      {pick("To", to, setTo, from)}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1.5">
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
              autoFocus
              defaultValue={values?.amount}
              placeholder="0"
              className={`${inputClass} pl-8 tabular-nums`}
            />
          </div>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Date</span>
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={values?.occurred_on || today}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Note</span>
        <input
          name="note"
          maxLength={120}
          defaultValue={values?.note}
          placeholder="Optional"
          className={inputClass}
        />
      </label>
      <ErrorBox error={state.error} />
      <button
        type="submit"
        disabled={pending || !from || !to || from === to}
        className="h-11 rounded-xl bg-ember text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
      >
        {pending ? "Moving…" : "Move money"}
      </button>
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
          className={`overflow-hidden rounded-lg bg-red-500/10 px-3 py-2 text-sm ${badText}`}
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
