"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteDebt,
  deletePerson,
} from "@/app/(dashboard)/financial/borrow/actions";
import { formatMoney, formatShortDate } from "@/lib/finance";
import { DEBT_KINDS, type DebtEntry, type PersonBalance } from "@/lib/debts";
import { Card } from "@/components/ui/kit";

// This month's plan for a person: money to return / collect
export type PersonPlan = {
  repay: { planned: number; actual: number } | null;
  collect: { planned: number; actual: number } | null;
};

export default function PeopleList({
  people,
  plans,
  monthLabel,
}: {
  people: PersonBalance[];
  plans: Record<string, PersonPlan>;
  monthLabel: string;
}) {
  const [showSettled, setShowSettled] = useState(false);
  const open = people.filter((p) => p.owe > 0 || p.owed > 0);
  const settled = people.length - open.length;
  const shown = showSettled ? people : open;

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-bold tracking-tight text-2xl">People</h3>
        {settled > 0 && (
          <button
            type="button"
            onClick={() => setShowSettled((v) => !v)}
            className="text-sm text-paper/50 transition hover:text-paper"
          >
            {showSettled ? "Hide settled" : `Show ${settled} settled`}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 card px-4 py-10 text-center text-sm text-paper/40">
          {people.length === 0
            ? "No one yet. Add money you took from or gave to someone."
            : "All settled. Nobody owes anything."}
        </p>
      ) : (
        <ul className="mt-3 grid items-start gap-2 lg:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {shown.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                plan={plans[person.id]}
                monthLabel={monthLabel}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function PersonCard({
  person,
  plan,
  monthLabel,
}: {
  person: PersonBalance;
  plan?: PersonPlan;
  monthLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const status =
    person.owe > 0
      ? { text: `You owe ${formatMoney(person.owe)}`, tone: "text-chart-expense" }
      : person.owed > 0
        ? { text: `Owes you ${formatMoney(person.owed)}`, tone: "text-moss" }
        : { text: "Settled", tone: "text-paper/45" };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: pending ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-inset border border-paper/10 bg-inset"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/10 font-medium">
          {person.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{person.name}</span>
          <span className="block text-xs text-paper/45">
            {person.entries.length}{" "}
            {person.entries.length === 1 ? "entry" : "entries"}
            {person.lastOn && ` · last ${formatShortDate(person.lastOn)}`}
          </span>
        </span>
        <span className={`shrink-0 text-right text-sm font-semibold ${status.tone}`}>
          {status.text}
        </span>
      </button>

      {plan && (plan.repay || plan.collect) && (
        <div className="flex flex-wrap gap-2 px-4 pb-4 text-xs">
          {plan.repay && (
            <PlanChip
              label={`${monthLabel} plan: return`}
              {...plan.repay}
            />
          )}
          {plan.collect && (
            <PlanChip
              label={`${monthLabel} plan: collect`}
              {...plan.collect}
            />
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-paper/10"
          >
            <ul className="px-4 py-2">
              {person.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
            <div className="flex justify-end px-4 pb-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    confirm(
                      `Remove ${person.name} and all their entries? Plan lines for them are removed too.`,
                    )
                  )
                    startTransition(() => deletePerson(person.id));
                }}
                className="rounded-lg px-2 py-1 text-xs text-paper/40 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                Remove person
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function PlanChip({
  label,
  planned,
  actual,
}: {
  label: string;
  planned: number;
  actual: number;
}) {
  const done = actual >= planned;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 ${
        done
          ? "border-moss/30 bg-moss/10 text-moss"
          : "border-ember/30 bg-ember/10 text-paper/80"
      }`}
    >
      {label} {formatMoney(planned)} · {done ? "done" : `${formatMoney(actual)} so far`}
    </span>
  );
}

function EntryRow({ entry }: { entry: DebtEntry }) {
  const [pending, startTransition] = useTransition();
  const meta = DEBT_KINDS.find((k) => k.kind === entry.kind)!;
  const incoming = entry.kind === "borrowed" || entry.kind === "received";

  return (
    <li
      className={`group flex items-center gap-3 border-b border-paper/5 py-2.5 text-sm last:border-0 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          {meta.verb} {entry.person.name}
        </span>
        <span className="block truncate text-xs text-paper/45">
          {formatShortDate(entry.occurred_on)}
          {entry.in_balance && " · added to balance"}
          {entry.note && ` · ${entry.note}`}
        </span>
      </span>
      <span
        className={`shrink-0 font-semibold tabular-nums ${incoming ? "text-moss" : ""}`}
      >
        {incoming ? "+" : "−"}
        {formatMoney(entry.amount)}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this entry?"))
            startTransition(() => deleteDebt(entry.id));
        }}
        aria-label="Delete entry"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
      >
        ×
      </button>
    </li>
  );
}
