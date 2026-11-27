"use client";

import { useState, useTransition } from "react";
import {
  logProgress,
  splitGoalByMonth,
  splitMonthByWeek,
} from "@/app/(dashboard)/plan/actions";
import type { PlanGoal } from "@/lib/plans";

// The actions here re-render the page themselves (revalidatePath), so the new
// numbers arrive with the reply; no second refresh is needed.

// "Log ₹5,000" for goals with a number
export function LogProgress({ goal, date }: { goal: PlanGoal; date: string }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!goal.target_value) return null;

  function save() {
    const value = amount;
    if (!value || pending) return;
    // Cleared at once; put back if the save fails
    setAmount("");
    setError(null);
    startTransition(async () => {
      const result = await logProgress({ goalId: goal.id, amount: value, date });
      if (!result.ok) {
        setError(result.error);
        setAmount((current) => current || value);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-xl bg-inset py-1 pl-3 pr-1">
        <span className="shrink-0 text-xs text-paper/70">Log progress</span>
        <input
          inputMode="decimal"
          enterKeyHint="done"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.\-]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && save()}
          placeholder={goal.unit === "₹" ? "₹ amount" : goal.unit ?? "amount"}
          aria-label={`Progress toward ${goal.title}`}
          className="h-9 min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-paper/45"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !amount}
          className="h-9 shrink-0 rounded-lg bg-moss px-3.5 text-sm font-semibold text-white transition disabled:opacity-40"
        >
          {pending ? "Saving…" : "+ Log"}
        </button>
      </div>
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

export function SplitButton({
  goal,
  mode,
  period,
  label,
}: {
  goal: PlanGoal;
  mode: "months" | "weeks";
  period: string; // first month to fill, or the month to split
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            mode === "months" &&
            !confirm("Replace monthly targets from this month on with an even split?")
          )
            return;
          setError(null);
          startTransition(async () => {
            const result =
              mode === "months"
                ? await splitGoalByMonth(goal.id, period)
                : await splitMonthByWeek(goal.id, period);
            if (!result.ok) setError(result.error);
          });
        }}
        className="flex h-9 items-center rounded-full border border-paper/15 px-3 text-xs font-semibold text-paper/78 transition hover:bg-paper/5 hover:text-paper disabled:opacity-50"
      >
        {pending ? "Splitting…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</span>}
    </span>
  );
}
