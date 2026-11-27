"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { addItem, deleteItem, updateItem } from "@/app/(dashboard)/plan/actions";
import { joinSpoken, ListeningBar, MicButton, useDictation } from "@/components/journal/voice-input";
import { formatAmount, type PlanGoal, type PlanItem, type PlanLevel } from "@/lib/plans";

type Change =
  | { type: "add"; item: PlanItem }
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "rename"; id: string; title: string };

type Draft = { goalId: string; title: string; target: string };
type Result = { ok: true } | { ok: false; error: string };

// Items added here that the server hasn't confirmed yet
const PENDING = "pending-";
const isPending = (item: PlanItem) => item.id.startsWith(PENDING);

// Tick, rename, delete and add plan items for one goal and period. Every
// change shows straight away; the server catches up behind it.
export default function ItemList({
  goal,
  goals,
  level,
  period,
  items,
  placeholder,
  showGoal = false,
  allowTarget = false,
  hideAdd = false,
  voice = false,
}: {
  goal?: PlanGoal; // fixed goal for new items
  goals?: PlanGoal[]; // or a picker, for mixed lists (Today, a week day)
  level: PlanLevel;
  period: string;
  items: PlanItem[];
  placeholder: string;
  showGoal?: boolean;
  allowTarget?: boolean;
  hideAdd?: boolean;
  // A mic in the add row, for the list you add to most
  voice?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [list, apply] = useOptimistic(items, (current: PlanItem[], change: Change) => {
    if (change.type === "add") return [...current, change.item];
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

  // Called inside the add row's transition: the row shows now, the save follows
  function add(draft: Draft): Promise<Result> {
    const target = allowTarget && draft.target ? Number(draft.target) : null;
    apply({
      type: "add",
      item: {
        id: `${PENDING}${Date.now()}-${Math.random().toString(36).slice(2)}`,
        goal_id: draft.goalId,
        level,
        period,
        title: draft.title,
        notes: "",
        target_value: target !== null && Number.isFinite(target) ? target : null,
        done: false,
        position: Number.MAX_SAFE_INTEGER,
      },
    });
    return addItem({
      goalId: draft.goalId,
      level,
      period,
      title: draft.title,
      target_value: allowTarget ? draft.target : null,
    });
  }

  return (
    <div>
      {list.length > 0 && (
        <ul className="flex flex-col">
          {list.map((item) => {
            const itemGoal = goalOf(item.goal_id);
            const pending = isPending(item);
            return (
              <li
                key={item.id}
                className={`group flex min-h-11 items-center gap-3 border-b border-paper/[0.06] py-1.5 transition-opacity last:border-0 ${
                  pending ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={`Mark "${item.title}" done`}
                  disabled={pending}
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
                  readOnly={pending}
                  enterKeyHint="done"
                  onBlur={(e) => {
                    const title = e.target.value.trim();
                    if (pending || !title || title === item.title) {
                      e.target.value = item.title;
                      return;
                    }
                    startTransition(async () => {
                      apply({ type: "rename", id: item.id, title });
                      await updateItem(item.id, { title });
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = item.title;
                      e.currentTarget.blur();
                    }
                  }}
                  className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none focus:underline focus:decoration-ember/40 ${
                    item.done ? "text-paper/60 line-through" : ""
                  }`}
                />
                {item.target_value !== null && (
                  <span className="shrink-0 rounded-full bg-paper/[0.06] px-2.5 py-1 text-xs font-semibold tabular-nums text-paper/72">
                    {formatAmount(item.target_value, itemGoal?.unit ?? null)}
                  </span>
                )}
                {!pending && (
                  <button
                    type="button"
                    aria-label={`Delete "${item.title}"`}
                    onClick={() =>
                      startTransition(async () => {
                        apply({ type: "remove", id: item.id });
                        await deleteItem(item.id);
                      })
                    }
                    className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-paper/40 transition hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100 dark:hover:text-red-300"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!hideAdd && (
        <AddRow
          goal={goal}
          goals={goals}
          placeholder={placeholder}
          allowTarget={allowTarget}
          voice={voice}
          divided={list.length > 0}
          count={list.length}
          onAdd={add}
        />
      )}
    </div>
  );
}

// The last line of the list: type and press Enter (or tap Add), and the next
// one is ready. Looks like a row, not a form, until you use it.
function AddRow({
  goal,
  goals,
  placeholder,
  allowTarget,
  voice,
  divided,
  count,
  onAdd,
}: {
  goal?: PlanGoal;
  goals?: PlanGoal[];
  placeholder: string;
  allowTarget: boolean;
  voice: boolean;
  divided: boolean;
  count: number;
  onAdd: (draft: Draft) => Promise<Result>;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [goalId, setGoalId] = useState(goal?.id ?? goals?.[0]?.id ?? "");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dictation = useDictation((spoken) => setTitle((t) => joinSpoken(t, spoken).slice(0, 200)));

  const chosen = goal ?? goals?.find((g) => g.id === goalId) ?? goals?.[0];
  const picker = !goal && (goals?.length ?? 0) > 1;
  const hasText = title.trim().length > 0;
  const active = focused || hasText || dictation.listening;
  const withTarget = allowTarget && !!chosen?.target_value && active;

  // Keep the add row in view as the list grows above it
  useEffect(() => {
    if (document.activeElement === input.current)
      input.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [count]);

  if (!chosen) return null;

  function submit() {
    const text = title.trim();
    if (!text || !chosen) return;
    if (dictation.listening) dictation.stop();
    // Cleared now, outside the transition, so the box is ready at once
    setTitle("");
    setTarget("");
    setError(null);
    const draft = { goalId: chosen.id, title: text, target };
    startTransition(async () => {
      const result = await onAdd(draft);
      if (!result.ok) {
        setError(result.error);
        setTitle((t) => t || text);
      }
    });
  }

  return (
    <div className={divided ? "border-t border-paper/[0.06]" : ""}>
      <div
        className={`-mx-2 flex min-h-11 items-center gap-3 rounded-xl px-2 py-1 transition-colors ${
          focused ? "bg-inset" : ""
        }`}
      >
        <label
          htmlFor={id}
          aria-hidden
          className="flex h-6 w-6 shrink-0 cursor-text items-center justify-center rounded-full border-[1.5px] border-dashed border-paper/30 text-sm leading-none text-paper/55"
        >
          +
        </label>
        {picker && (
          <span
            title={`Goal: ${chosen.title}`}
            className="relative -ml-1 flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-paper/[0.06] pl-2 pr-1.5 text-base has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ember/40"
          >
            <span aria-hidden>{chosen.emoji}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-paper/50">
              <path d="m6 9 6 6 6-6" />
            </svg>
            {/* The phone's own picker, laid invisibly over the chip */}
            <select
              value={chosen.id}
              onChange={(e) => setGoalId(e.target.value)}
              aria-label="Goal"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {goals!.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.title}
                </option>
              ))}
            </select>
          </span>
        )}
        <input
          id={id}
          ref={input}
          value={title}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="enter"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              setTitle("");
              e.currentTarget.blur();
            }
          }}
          placeholder={dictation.listening ? "Listening…" : placeholder}
          aria-label={placeholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-paper/50"
        />
        {withTarget && (
          <input
            inputMode="decimal"
            value={target}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={chosen.unit ?? "#"}
            aria-label={`Target in ${chosen.unit ?? "units"} (optional)`}
            className="h-8 w-[4.5rem] shrink-0 rounded-lg border border-paper/10 bg-surface/40 px-2 text-right text-sm tabular-nums outline-none placeholder:text-paper/45 focus:border-ember/60"
          />
        )}
        {voice && (dictation.listening || !hasText) && <MicButton d={dictation} quiet />}
        {hasText && (
          <button
            type="button"
            // Keep focus (and the phone's keyboard) in the box for the next one
            onMouseDown={(e) => e.preventDefault()}
            onClick={submit}
            className="h-8 shrink-0 rounded-full bg-ember px-3.5 text-sm font-semibold text-on-ember transition active:scale-95"
          >
            Add
          </button>
        )}
      </div>
      {voice && dictation.status && <ListeningBar d={dictation} />}
      {error && (
        <p role="alert" className="pt-1 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
