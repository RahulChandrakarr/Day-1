"use client";

import { useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteTransaction } from "@/app/(dashboard)/financial/actions";
import { deleteDebt } from "@/app/(dashboard)/financial/borrow/actions";
import { deleteInvestmentEntry } from "@/app/(dashboard)/financial/savings/actions";
import { deleteTransfer } from "@/app/(dashboard)/financial/bank/actions";
import { DEBT_KINDS, type DebtEntry } from "@/lib/debts";
import {
  formatMoney,
  formatShortDate,
  type BankTransfer,
  type Transaction,
} from "@/lib/finance";
import type { InvestmentEntry } from "@/lib/investments";

export type SavingsActivity = InvestmentEntry & {
  accountName: string;
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
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300";

function Row({ tx, showDate }: { tx: Transaction; showDate: boolean }) {
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
      <span
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: `var(--cat-${tx.category?.color ?? 8})` }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-snug line-clamp-2">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper/45">
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
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper/45">
          <span className="shrink-0 rounded-full border border-paper/15 px-1.5">
            {badge}
          </span>
          {subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
          {showDate && <span>· {formatShortDate(occurredOn)}</span>}
        </p>
      </div>
      <p
        className={`shrink-0 text-right font-semibold tabular-nums ${
          incoming ? "text-moss" : incoming === null ? "text-paper/70" : ""
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
  | { type: "transfer"; key: string; on: string; at: string; transfer: BankTransfer };

export default function TransactionList({
  title,
  transactions,
  showDate = false,
  empty = "No entries yet.",
  debts = [],
  savings = [],
  transfers = [],
}: {
  title: string;
  transactions: Transaction[];
  showDate?: boolean;
  empty?: string;
  debts?: DebtEntry[];
  savings?: SavingsActivity[];
  transfers?: BankTransfer[];
}) {
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
    ...transfers.map((transfer) => ({
      type: "transfer" as const,
      key: `transfer-${transfer.id}`,
      on: transfer.occurred_on,
      at: transfer.created_at,
      transfer,
    })),
  ];
  // Newest first, same order as the transactions query
  if (debts.length || savings.length || transfers.length)
    items.sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at));

  return (
    <section className="min-w-0 rounded-[18px] border border-paper/10 bg-surface p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-2xl">{title}</h3>
        <span className="text-sm text-paper/45">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-dashed border-paper/10 py-10 text-center text-sm text-paper/40">
          {empty}
        </p>
      ) : (
        <ul className="mt-3">
          <AnimatePresence initial={false}>
            {items.map((item) =>
              item.type === "tx" ? (
                <Row key={item.key} tx={item.tx} showDate={showDate} />
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
    </section>
  );
}
