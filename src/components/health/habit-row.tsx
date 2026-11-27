"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { saveHabitCheckin } from "@/app/(dashboard)/health/actions";
import type { HabitCheckin } from "@/lib/health";
import type { Habit } from "@/lib/journal";

type Status = "did" | "skip" | null;

// One habit, the way the Overview design shows it: tick or cross, and a
// counter for habits that count something.
export default function HabitRow({
  habit,
  date,
  checkin,
  streak,
  first,
}: {
  habit: Habit;
  date: string;
  checkin: HabitCheckin | null;
  streak: number;
  first: boolean;
}) {
  const [status, setStatus] = useState<Status>(
    checkin ? (checkin.done ? "did" : "skip") : null,
  );
  const [count, setCount] = useState(checkin?.count ?? 0);
  const [, startTransition] = useTransition();

  function save(next: { done: boolean | null; count?: number | null }) {
    startTransition(async () => {
      await saveHabitCheckin({
        habitId: habit.id,
        date,
        done: next.done,
        count: next.count ?? (habit.count_label ? count : null),
      });
    });
  }

  function resolve(value: Exclude<Status, null>) {
    setStatus(value);
    save({ done: value === "did" });
  }

  function changeCount(next: number) {
    const value = Math.max(0, next);
    setCount(value);
    // Logging a number is itself a check-in, judged against the daily limit
    const done =
      habit.daily_limit === null
        ? true
        : habit.kind === "quit"
          ? value <= habit.daily_limit
          : value >= habit.daily_limit;
    setStatus(done ? "did" : "skip");
    save({ done, count: value });
  }

  const did = status === "did";
  const sub = did
    ? "Nice — logged for today"
    : streak > 0
      ? `${streak}-day streak`
      : "No streak yet";

  return (
    <li className={first ? "" : "border-t border-paper/[0.06]"}>
      <div className="px-4 py-3">
        <div className="flex min-h-11 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{habit.name}</p>
            <p
              className={`mt-0.5 text-xs ${
                did || streak > 0 ? "text-moss" : "text-paper/60"
              }`}
            >
              {sub}
            </p>
          </div>

          {status === null ? (
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={`${habit.name}: did it`}
                onClick={() => resolve("did")}
                className="h-11 w-11 rounded-full border-[1.5px] border-moss/45 text-[17px] text-moss transition active:bg-moss/10"
              >
                ✓
              </button>
              <button
                type="button"
                aria-label={`${habit.name}: didn't`}
                onClick={() => resolve("skip")}
                className="h-11 w-11 rounded-full border-[1.5px] border-paper/15 text-[15px] text-paper/70 transition active:bg-paper/5"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  did ? "bg-moss/15 text-moss" : "bg-paper/[0.07] text-paper/70"
                }`}
              >
                {did ? "Did it" : "Didn't"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setStatus(null);
                  save({ done: null });
                }}
                className="px-0.5 py-1.5 text-xs text-paper/55 transition hover:text-paper"
              >
                Undo
              </button>
            </div>
          )}
        </div>

        {habit.count_label && (
          <div className="mt-2.5 flex items-center gap-3 rounded-xl bg-inset px-2.5 py-2">
            <span className="flex-1 text-xs text-paper/70">
              How many today?
              {habit.daily_limit !== null &&
                ` · ${habit.kind === "quit" ? "max" : "goal"} ${habit.daily_limit}`}
            </span>
            <button
              type="button"
              aria-label="One less"
              onClick={() => changeCount(count - 1)}
              className="h-8 w-8 rounded-[10px] border border-paper/15 bg-surface text-base transition active:bg-paper/5"
            >
              −
            </button>
            <motion.span
              key={count}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`min-w-5 text-center text-base font-bold ${
                // Under the max is good for a habit you quit; at or over the
                // goal is good for one you build
                habit.daily_limit === null ||
                (habit.kind === "quit"
                  ? count <= habit.daily_limit
                  : count >= habit.daily_limit)
                  ? "text-moss"
                  : "text-[#b3372e] dark:text-red-300"
              }`}
            >
              {count}
            </motion.span>
            <button
              type="button"
              aria-label="One more"
              onClick={() => changeCount(count + 1)}
              className="h-8 w-8 rounded-[10px] border border-paper/15 bg-surface text-base transition active:bg-paper/5"
            >
              +
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
