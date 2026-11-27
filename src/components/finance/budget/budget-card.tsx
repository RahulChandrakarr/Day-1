"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteBudget } from "@/app/(dashboard)/financial/actions";
import type {
  Budget,
  BudgetReport,
  BudgetScope,
  Category,
} from "@/lib/finance";
import { Card, PencilIcon, TrashIcon } from "@/components/ui/kit";
import BudgetEditor, { type PlanEmi, type PlanPerson } from "./budget-editor";
import BudgetReportView from "./budget-report";

type Mode = "view" | "edit" | "copy" | "new";

// Plan vs actual for one month or year: report, editor, or empty state.
export default function BudgetCard({
  scope,
  periodKey,
  periodLabel,
  budget,
  report,
  previous,
  previousLabel,
  categories,
  people,
  emis,
}: {
  scope: BudgetScope;
  periodKey: string;
  periodLabel: string;
  budget: Budget | null;
  report: BudgetReport | null;
  previous: Budget | null;
  previousLabel: string | null;
  categories: Category[];
  people: PlanPerson[];
  emis: PlanEmi[];
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [deleting, startDelete] = useTransition();
  const editing = mode !== "view";
  const noun = scope === "month" ? "month" : "year";

  const editorInitial =
    mode === "edit" ? budget : mode === "copy" ? previous : null;

  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[19px] font-bold tracking-[-0.01em]">
            {editing
              ? budget
                ? `Edit plan for ${periodLabel}`
                : `Plan ${periodLabel}`
              : "Plan vs actual"}
          </h3>
          <p className="mt-0.5 text-sm text-paper/65">
            {editing
              ? mode === "copy" && previousLabel
                ? `Starting from ${previousLabel}. Adjust and save.`
                : "Estimate your income, spending and savings."
              : budget
                ? `Your estimate for ${periodLabel}, against what you logged.`
                : `No plan for ${periodLabel} yet.`}
          </p>
        </div>
        {!editing && budget && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setMode("edit")}
              aria-label="Edit plan"
              title="Edit plan"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/15 text-paper/78 transition hover:bg-paper/5 hover:text-paper"
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (confirm(`Delete the plan for ${periodLabel}?`))
                  startDelete(() => deleteBudget(budget.id));
              }}
              aria-label={deleting ? "Deleting plan" : "Delete plan"}
              title="Delete plan"
              className="flex h-10 w-10 items-center justify-center rounded-full text-paper/60 transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-300"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {editing ? (
            <BudgetEditor
              scope={scope}
              periodKey={periodKey}
              categories={categories}
              people={people}
              emis={emis}
              initial={editorInitial}
              onCancel={() => setMode("view")}
              onSaved={() => setMode("view")}
            />
          ) : budget && report ? (
            <BudgetReportView report={report} periodLabel={periodLabel} />
          ) : (
            <div className="flex flex-col items-center gap-4 card px-4 py-10 text-center">
              <p className="max-w-sm text-sm text-paper/70">
                Set how much goes to rent, EMI, bills and savings this {noun}.
                Keep logging as usual and see how the estimate holds up.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className="h-11 rounded-xl border border-paper/15 px-5 text-sm font-medium transition hover:bg-paper/5"
                >
                  Create plan
                </button>
                {previous && previousLabel && (
                  <button
                    type="button"
                    onClick={() => setMode("copy")}
                    className="h-11 rounded-xl border border-paper/15 px-5 text-sm font-medium transition hover:bg-paper/5"
                  >
                    Copy from {previousLabel}
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
