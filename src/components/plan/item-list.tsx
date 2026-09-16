"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addItem, deleteItem, updateItem } from "@/app/(dashboard)/plan/actions";
import { formatAmount, type PlanGoal, type PlanItem, type PlanLevel } from "@/lib/plans";

type Change =
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "rename"; id: string; title: string };

// Tick, rename, delete and add plan items for one goal and period.
export default function ItemList({
  goal,
  goals,
  level,
  period,
  items,
  placeholder,
  showGoal = false,
  allowTarget = false,
}: {
  goal?: PlanGoal; // fixed goal for new items
  goals?: PlanGoal[]; // or a picker, for mixed lists (Today, a week day)
  level: PlanLevel;
  period: string;
  items: PlanItem[];
  placeholder: string;
  showGoal?: boolean;
  allowTarget?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [list, apply] = useOptimistic(items, (current: PlanItem[], change: Change) => {
    if (change.type === "remove") return current.filter((i) => i.id !== change.id);
    return current.map((i) =>
      i.id !== change.id
        ? i
        : change.type === "toggle"
          ? { ...i, done: !i.done }
          : { ...i, title: change.title },
    );
  });
  const goalOf = (id: string) => goals?.find((g) => g.id === id) ?? goal;

  return (
    <div>
      {list.length > 0 && (
        <ul className="flex flex-col">
          {list.map((item) => {
            const itemGoal = goalOf(item.goal_id);
            return (
              <li key={item.id} className="group flex min-h-11 items-center gap-3 border-b border-paper/[0.06] py-1.5 last:border-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={`Mark "${item.title}" done`}
                  onClick={() =>
                    startTransition(async () => {
                      apply({ type: "toggle", id: item.id });
                      await updateItem(item.id, { done: !item.done });
                    })
                  }
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[13px] transition ${
                    item.done
                      ? "border-moss bg-moss text-white"
                      : "border-paper/25 hover:border-paper/50"
                  }`}
                >
                  {item.done && "✓"}
                </button>
                {showGoal && itemGoal && (
                  <span title={itemGoal.title} className="shrink-0 text-base">
                    {itemGoal.emoji}
                  </span>
                )}
                <input
                  defaultValue={item.title}
                  aria-label="Task"
                  maxLength={200}
                  onBlur={(e) => {
                    const title = e.target.value.trim();
                    if (!title || title === item.title) {
                      e.target.value = item.title;
                      return;
                    }
                    startTransition(async () => {
                      apply({ type: "rename", id: item.id, title });
                      await updateItem(item.id, { title });
                    });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none focus:underline focus:decoration-ember/40 ${
                    item.done ? "text-paper/45 line-through" : ""
                  }`}
                />
                {item.target_value !== null && (
                  <span className="shrink-0 rounded-full bg-paper/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums text-paper/60">
                    {formatAmount(item.target_value, itemGoal?.unit ?? null)}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Delete "${item.title}"`}
                  onClick={() =>
                    startTransition(async () => {
                      apply({ type: "remove", id: item.id });
                      await deleteItem(item.id);
                    })
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-paper/30 transition hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AddRow
        goal={goal}
        goals={goals}
        level={level}
        period={period}
        placeholder={placeholder}
        allowTarget={allowTarget}
      />
    </div>
  );
}

function AddRow({
  goal,
  goals,
  level,
  period,
  placeholder,
  allowTarget,
}: {
  goal?: PlanGoal;
  goals?: PlanGoal[];
  level: PlanLevel;
  period: string;
  placeholder: string;
  allowTarget: boolean;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [goalId, setGoalId] = useState(goal?.id ?? goals?.[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chosen = goal ?? goals?.find((g) => g.id === goalId);

  function add() {
    if (!title.trim() || !goalId) return;
    setError(null);
    startTransition(async () => {
      const result = await addItem({
        goalId,
        level,
        period,
        title,
        target_value: allowTarget ? target : null,
      });
      if (result.ok) {
        setTitle("");
        setTarget("");
      } else setError(result.error);
    });
  }

  if (!goalId) return null;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2 pt-1.5">
        {goals && !goal && (
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            aria-label="Goal"
            className="h-10 max-w-[7.5rem] shrink-0 rounded-xl border border-paper/10 bg-ink px-2 text-sm outline-none"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji} {g.title}
              </option>
            ))}
          </select>
        )}
        <input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 rounded-xl border border-dashed border-paper/15 bg-transparent px-3 text-sm outline-none transition placeholder:text-paper/35 focus:border-ember/60"
        />
        {allowTarget && chosen?.target_value && (
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={chosen.unit ?? "#"}
            aria-label="Target"
            className="h-10 w-20 shrink-0 rounded-xl border border-paper/10 bg-ink px-2 text-sm tabular-nums outline-none"
          />
        )}
        <button
          type="button"
          onClick={add}
          disabled={pending || !title.trim()}
          className="h-10 shrink-0 rounded-xl bg-ember px-3 text-sm font-semibold text-on-ember transition disabled:opacity-40"
        >
          {pending ? "…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
