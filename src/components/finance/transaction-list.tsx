"use client";

import { useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteTransaction } from "@/app/(dashboard)/financial/actions";
import { formatMoney, formatShortDate, type Transaction } from "@/lib/finance";

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
        <p className="truncate font-medium">{title}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-paper/45">
          <span>{tx.category?.name ?? "Uncategorized"}</span>
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
      >
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
      </button>
    </motion.li>
  );
}

export default function TransactionList({
  title,
  transactions,
  showDate = false,
  empty = "No entries yet.",
}: {
  title: string;
  transactions: Transaction[];
  showDate?: boolean;
  empty?: string;
}) {
  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-2xl">{title}</h3>
        <span className="text-sm text-paper/45">
          {transactions.length}{" "}
          {transactions.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {transactions.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-paper/10 py-10 text-center text-sm text-paper/40">
          {empty}
        </p>
      ) : (
        <ul className="mt-3">
          <AnimatePresence initial={false}>
            {transactions.map((tx) => (
              <Row key={tx.id} tx={tx} showDate={showDate} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
