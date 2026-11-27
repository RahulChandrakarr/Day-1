"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteTransaction } from "@/app/(dashboard)/financial/actions";
import { deleteDebt } from "@/app/(dashboard)/financial/borrow/actions";
import { deleteEmiPayment } from "@/app/(dashboard)/financial/emi/actions";
import { deleteInvestmentEntry } from "@/app/(dashboard)/financial/savings/actions";
import { deleteTransfer } from "@/app/(dashboard)/financial/bank/actions";
import EditEntry from "@/components/finance/edit-entry";
import type { BankOption } from "@/components/finance/entry-dialog";
import Sheet from "@/components/ui/sheet";
import { DEBT_KINDS, type DebtEntry } from "@/lib/debts";
import {
  formatMoney,
  formatShortDate,
  type BankTransfer,
  type Category,
  type Transaction,
} from "@/lib/finance";
import type { InvestmentEntry } from "@/lib/investments";
import type { EmiPayment } from "@/lib/emis";
import { Card } from "@/components/ui/kit";

export type SavingsActivity = InvestmentEntry & {
  accountName: string;
  color: number;
};

export type EmiActivity = EmiPayment & {
  emiName: string;
  color: number;
};

const trashIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

const deleteButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/45 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300";

function Row({
  tx,
  showDate,
  onEdit,
}: {
  tx: Transaction;
  showDate: boolean;
  onEdit?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const title = tx.description || tx.category?.name || "Untitled";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="group flex items-center gap-3 overflow-hidden border-b border-paper/5 py-3 last:border-b-0"
    >
      <Tappable onClick={onEdit} label={`Edit ${title}`}>
      <span
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--cat-${tx.category?.color ?? 8})` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-snug line-clamp-2">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper/60">
          <span>{tx.category?.name ?? "Uncategorized"}</span>
          {tx.bank_account && <span>· {tx.bank_account.name}</span>}
          {showDate && <span>· {formatShortDate(tx.occurred_on)}</span>}
          {tx.period !== "daily" && (
            <span className="rounded-full border border-paper/15 px-1.5 capitalize">
              {tx.period}
            </span>
          )}
        </p>
      </div>
      <p
        className={`shrink-0 text-right font-semibold tabular-nums ${
          tx.type === "income" ? "text-moss" : ""
        }`}
      >
        {tx.type === "income" ? "+" : "−"}
        {formatMoney(tx.amount)}
      </p>
      </Tappable>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${title}"?`))
            startTransition(() => deleteTransaction(tx.id));
        }}
        aria-label={`Delete ${title}`}
        className={deleteButtonClass}
      >
        {trashIcon}
      </button>
    </motion.li>
  );
}

// The row's body opens the editor when it can be edited
function Tappable({
  onClick,
  label,
  children,
}: {
  onClick?: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!onClick) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:opacity-70"
    >
      {children}
    </button>
  );
}

// Borrow and savings entries, shown in the same list as a day's transactions
function ActivityRow({
  title,
  subtitle,
  badge,
  color,
  amount,
  incoming,
  showDate,
  occurredOn,
  onDelete,
}: {
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  amount: number;
  incoming: boolean | null; // null: moved between your own accounts
  showDate: boolean;
  occurredOn: string;
  onDelete: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="group flex items-center gap-3 overflow-hidden border-b border-paper/5 py-3 last:border-b-0"
    >
      <span
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-snug line-clamp-2">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper/60">
          <span className="shrink-0 rounded-full border border-paper/15 px-1.5">
            {badge}
          </span>
          {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
          {showDate && <span>· {formatShortDate(occurredOn)}</span>}
        </p>
      </div>
      <p
        className={`shrink-0 text-right font-semibold tabular-nums ${
          incoming ? "text-moss" : incoming === null ? "text-paper/78" : ""
        }`}
      >
        {incoming === null ? "" : incoming ? "+" : "−"}
        {formatMoney(amount)}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${title}"?`)) startTransition(onDelete);
        }}
        aria-label={`Delete ${title}`}
        className={deleteButtonClass}
      >
        {trashIcon}
      </button>
    </motion.li>
  );
}

type Item =
  | { type: "tx"; key: string; on: string; at: string; tx: Transaction }
  | { type: "debt"; key: string; on: string; at: string; debt: DebtEntry }
  | { type: "saving"; key: string; on: string; at: string; entry: SavingsActivity }
  | { type: "emi"; key: string; on: string; at: string; payment: EmiActivity }
  | { type: "transfer"; key: string; on: string; at: string; transfer: BankTransfer };

export default function TransactionList({
  title,
  transactions,
  showDate = false,
  empty = "No entries yet.",
  debts = [],
  savings = [],
  emis = [],
  transfers = [],
  categories,
  bankAccounts = [],
  aside,
}: {
  title: string;
  transactions: Transaction[];
  showDate?: boolean;
  empty?: string;
  debts?: DebtEntry[];
  savings?: SavingsActivity[];
  emis?: EmiActivity[];
  transfers?: BankTransfer[];
  // Given categories, income and expense rows open an editor when tapped
  categories?: Category[];
  bankAccounts?: BankOption[];
  aside?: ReactNode; // replaces the entry count in the header
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const items: Item[] = [
    ...transactions.map((tx) => ({
      type: "tx" as const,
      key: `tx-${tx.id}`,
      on: tx.occurred_on,
      at: tx.created_at,
      tx,
    })),
    ...debts.map((debt) => ({
      type: "debt" as const,
      key: `debt-${debt.id}`,
      on: debt.occurred_on,
      at: debt.created_at,
      debt,
    })),
    ...savings.map((entry) => ({
      type: "saving" as const,
      key: `saving-${entry.id}`,
      on: entry.occurred_on,
      at: entry.created_at,
      entry,
    })),
    ...emis.map((payment) => ({
      type: "emi" as const,
      key: `emi-${payment.id}`,
      on: payment.occurred_on,
      at: payment.created_at,
      payment,
    })),
    ...transfers.map((transfer) => ({
      type: "transfer" as const,
      key: `transfer-${transfer.id}`,
      on: transfer.occurred_on,
      at: transfer.created_at,
      transfer,
    })),
  ];
  // Newest first, same order as the transactions query
  if (debts.length || savings.length || emis.length || transfers.length)
    items.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold tracking-tight text-2xl">{title}</h3>
        {aside ?? (
          <span className="text-sm text-paper/60">
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-6 card py-10 text-center text-sm text-paper/55">
          {empty}
        </p>
      ) : (
        <ul className="mt-3">
          <AnimatePresence initial={false}>
            {items.map((item) =>
              item.type === "tx" ? (
                <Row
                  key={item.key}
                  tx={item.tx}
                  showDate={showDate}
                  onEdit={categories ? () => setEditing(item.tx) : undefined}
                />
              ) : item.type === "debt" ? (
                <ActivityRow
                  key={item.key}
                  title={`${DEBT_KINDS.find((k) => k.kind === item.debt.kind)!.verb} ${item.debt.person.name}`}
                  subtitle={[
                    item.debt.in_balance ? "added to balance" : "kept separate",
                    item.debt.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  badge="Borrow"
                  color="var(--ember)"
                  amount={item.debt.amount}
                  incoming={
                    item.debt.kind === "borrowed" ||
                    item.debt.kind === "received"
                  }
                  showDate={showDate}
                  occurredOn={item.on}
                  onDelete={() => deleteDebt(item.debt.id)}
                />
              ) : item.type === "transfer" ? (
                <ActivityRow
                  key={item.key}
                  title={`Moved to ${item.transfer.to.name}`}
                  subtitle={[`from ${item.transfer.from.name}`, item.transfer.note]
                    .filter(Boolean)
                    .join(" · ")}
                  badge="Transfer"
                  color={`var(--cat-${item.transfer.to.color})`}
                  amount={item.transfer.amount}
                  incoming={null}
                  showDate={showDate}
                  occurredOn={item.on}
                  onDelete={() => deleteTransfer(item.transfer.id)}
                />
              ) : item.type === "emi" ? (
                <ActivityRow
                  key={item.key}
                  title={`EMI · ${item.payment.emiName}`}
                  subtitle={item.payment.note ?? ""}
                  badge="EMI"
                  color={`var(--cat-${item.payment.color})`}
                  amount={item.payment.amount}
                  incoming={false}
                  showDate={showDate}
                  occurredOn={item.on}
                  onDelete={() => deleteEmiPayment(item.payment.id)}
                />
              ) : (
                <ActivityRow
                  key={item.key}
                  title={`${item.entry.kind === "withdrawal" ? "Took out of" : "Put into"} ${item.entry.accountName}`}
                  subtitle={item.entry.note ?? ""}
                  badge="Savings"
                  color={`var(--cat-${item.entry.color})`}
                  amount={item.entry.amount}
                  incoming={item.entry.kind === "withdrawal"}
                  showDate={showDate}
                  occurredOn={item.on}
                  onDelete={() => deleteInvestmentEntry(item.entry.id)}
                />
              ),
            )}
          </AnimatePresence>
        </ul>
      )}

      {categories && (
        <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit entry">
          {editing && (
            <EditEntry
              key={editing.id}
              tx={editing}
              categories={categories}
              bankAccounts={bankAccounts}
              onDone={() => setEditing(null)}
            />
          )}
        </Sheet>
      )}
    </Card>
  );
}
