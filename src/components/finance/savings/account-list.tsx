"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteAccount,
  deleteInvestmentEntry,
} from "@/app/(dashboard)/financial/savings/actions";
import { formatMoney, formatShortDate } from "@/lib/finance";
import {
  accountKindLabel,
  type AccountSummary,
  type InvestmentEntry,
} from "@/lib/investments";

const signed = (n: number) => `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n))}`;
const pct = (gain: number, base: number) =>
  base > 0 ? `${gain < 0 ? "−" : "+"}${Math.abs((gain / base) * 100).toFixed(1)}%` : null;

export default function AccountList({
  accounts,
}: {
  accounts: AccountSummary[];
}) {
  const total = accounts.reduce((s, a) => s + Math.max(a.current, 0), 0);

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-5 sm:p-6">
      <h3 className="font-serif text-2xl">Accounts</h3>

      {accounts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-paper/10 px-4 py-10 text-center text-sm text-paper/40">
          No accounts yet. Add your FDs, SIPs, stocks or savings to track them.
        </p>
      ) : (
        <>
          {total > 0 && (
            <div className="mt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-paper/10">
                {accounts
                  .filter((a) => a.current > 0)
                  .map((a, i) => (
                    <motion.div
                      key={a.id}
                      title={`${a.name}: ${formatMoney(a.current)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(a.current / total) * 100}%` }}
                      transition={{ delay: 0.05 * i, duration: 0.6 }}
                      style={{ background: `var(--cat-${a.color})` }}
                    />
                  ))}
              </div>
              <p className="mt-1.5 text-xs text-paper/45">
                Where your {formatMoney(total)} is
              </p>
            </div>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} total={total} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </section>
  );
}

function AccountCard({
  account,
  total,
}: {
  account: AccountSummary;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const gainPct = pct(account.gain, account.invested);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-2xl border border-paper/10 bg-ink/30"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: `var(--cat-${account.color})` }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{account.name}</span>
          <span className="block truncate text-xs text-paper/45">
            {accountKindLabel(account.kind)}
            {total > 0 &&
              account.current > 0 &&
              ` · ${Math.round((account.current / total) * 100)}%`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-semibold tabular-nums">
            {formatMoney(account.current)}
          </span>
          {account.valuedOn && account.gain !== 0 ? (
            <span
              className={`block text-xs tabular-nums ${
                account.gain >= 0 ? "text-moss" : "text-red-700 dark:text-red-300"
              }`}
            >
              {signed(account.gain)}
              {gainPct && ` (${gainPct})`}
            </span>
          ) : (
            <span className="block text-xs text-paper/40">
              {formatMoney(account.invested)} put in
            </span>
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-paper/10"
          >
            <dl className="grid grid-cols-3 gap-3 px-4 pt-3 text-xs">
              <div>
                <dt className="text-paper/45">Put in</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(account.invested)}
                </dd>
              </div>
              <div>
                <dt className="text-paper/45">Worth now</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(account.current)}
                </dd>
              </div>
              <div>
                <dt className="text-paper/45">Value updated</dt>
                <dd className="font-medium">
                  {account.valuedOn ? formatShortDate(account.valuedOn) : "Never"}
                </dd>
              </div>
            </dl>
            <ul className="px-4 py-2">
              {account.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
              {account.entries.length === 0 && (
                <li className="py-3 text-sm text-paper/40">No entries yet.</li>
              )}
            </ul>
            <div className="flex justify-end px-4 pb-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Delete ${account.name} and all its entries?`))
                    startTransition(() => deleteAccount(account.id));
                }}
                className="rounded-lg px-2 py-1 text-xs text-paper/40 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                Delete account
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const entryLabels = {
  deposit: "Put in",
  withdrawal: "Took out",
  value: "Value updated",
} as const;

function EntryRow({ entry }: { entry: InvestmentEntry }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`group flex items-center gap-3 border-b border-paper/5 py-2.5 text-sm last:border-0 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{entryLabels[entry.kind]}</span>
        <span className="block truncate text-xs text-paper/45">
          {formatShortDate(entry.occurred_on)}
          {entry.note && ` · ${entry.note}`}
        </span>
      </span>
      <span
        className={`shrink-0 font-semibold tabular-nums ${
          entry.kind === "deposit"
            ? "text-moss"
            : entry.kind === "value"
              ? "text-paper/60"
              : ""
        }`}
      >
        {entry.kind === "deposit" ? "+" : entry.kind === "withdrawal" ? "−" : "="}
        {formatMoney(entry.amount)}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this entry?"))
            startTransition(() => deleteInvestmentEntry(entry.id));
        }}
        aria-label="Delete entry"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
      >
        ×
      </button>
    </li>
  );
}
