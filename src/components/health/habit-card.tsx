"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "@/components/ui/sheet";
import { deleteHabit, updateHabit } from "@/app/(dashboard)/daily/actions";
import { saveHabitCheckin } from "@/app/(dashboard)/health/actions";
import { addDays, formatShortDate } from "@/lib/finance";
import {
  feelingsFor,
  reasonsFor,
  type Feeling,
  type HabitCheckin,
  type Reason,
} from "@/lib/health";
import type { Habit } from "@/lib/journal";

const fieldClass =
  "h-11 min-w-0 rounded-xl border border-paper/10 bg-inset px-3 text-sm text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

const weekdayNarrow = new Intl.DateTimeFormat("en-IN", {
  weekday: "narrow",
  timeZone: "UTC",
});

type Draft = {
  done: boolean | null;
  count: number | null;
  feeling: Feeling | null;
  reason: Reason | null;
  note: string;
};

// One habit: did it / didn't today, how it felt or why not, streak and last 7
// days. Its settings and Remove sit behind the ⋯ button.
export default function HabitCard({
  habit,
  date,
  checkin,
  history,
  streak,
  missedNote = null,
  compact = false,
}: {
  habit: Habit;
  date: string;
  checkin: HabitCheckin | null;
  history: HabitCheckin[]; // last 7 days for this habit
  streak: number;
  missedNote?: string | null; // the most common reason for missing it
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({
    done: checkin?.done ?? null,
    count: checkin?.count ?? null,
    feeling: checkin?.feeling ?? null,
    reason: checkin?.reason ?? null,
    note: checkin?.note ?? "",
  });
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState({
    kind: habit.kind,
    count_label: habit.count_label ?? "",
    daily_limit: habit.daily_limit === null ? "" : String(habit.daily_limit),
  });
  const [details, setDetails] = useState(
    Boolean(checkin?.feeling || checkin?.reason || checkin?.note),
  );
  const [error, setError] = useState(false);
  const [removing, startRemove] = useTransition();
  const noteTimer = useRef<number | null>(null);
  const latest = useRef(draft);

  function saveCount() {
    void updateHabit(habit.id, {
      count_label: settings.count_label,
      daily_limit:
        settings.daily_limit === "" ? null : Number(settings.daily_limit),
    });
  }

  function persist(next: Draft) {
    setError(false);
    void saveHabitCheckin({ habitId: habit.id, date, ...next }).then((r) =>
      setError(!r.ok),
    );
  }

  function change(patch: Partial<Draft>, { debounce = false } = {}) {
    const next = { ...latest.current, ...patch };
    // Switching done/not done clears the other side's answer
    if (patch.done !== undefined && patch.done !== latest.current.done) {
      next.feeling = null;
      next.reason = null;
    }
    latest.current = next;
    setDraft(next);
    if (patch.done !== undefined && patch.done !== null) setDetails(false);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    if (debounce)
      noteTimer.current = window.setTimeout(() => persist(next), 700);
    else persist(next);
  }

  // What's already answered, shown on the collapsed link
  const answer = draft.done
    ? feelingsFor(habit.kind).find((f) => f.value === draft.feeling)?.label
    : reasonsFor(habit.kind).find((r) => r.value === draft.reason)?.label;
  const summary = answer
    ? `${answer}${draft.note ? ` · ${draft.note}` : ""}`
    : draft.note || null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  // Past days from the server; the selected day follows what's on screen
  const byDate = new Map(history.map((c) => [c.check_date, c]));
  if (draft.done === null) byDate.delete(date);
  else
    byDate.set(date, {
      habit_id: habit.id,
      check_date: date,
      done: draft.done,
      count: draft.count,
      feeling: draft.feeling,
      reason: draft.reason,
      note: draft.note,
    });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: removing ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`card rounded-3xl ${
        compact ? "p-3" : "p-4"
      } ${
        draft.done === true
          ? "border-moss/40"
          : draft.done === false
            ? "border-chart-expense/40"
            : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className={`truncate font-medium ${compact ? "" : "text-lg"}`}>
            {habit.name}
          </h4>
          <p className="text-xs text-paper/65">
            {streak > 0 ? `🔥 ${streak} day${streak === 1 ? "" : "s"} in a row` : "No streak yet"}
          </p>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label={`${habit.name}: settings`}
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl leading-none text-paper/55 transition hover:bg-paper/5 hover:text-paper"
          >
            ⋯
          </button>
        )}
      </div>

      {!compact && (
        <ul className="mt-3 flex justify-between gap-1" aria-label="Last 7 days">
          {days.map((d) => {
            const c = byDate.get(d);
            return (
              <li
                key={d}
                title={`${formatShortDate(d)}: ${c ? (c.done ? "done" : "missed") : "no check-in"}`}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span
                  className={`h-3 w-3 rounded-full ${
                    c ? (c.done ? "bg-moss" : "bg-chart-expense") : "bg-paper/10"
                  } ${d === date ? "ring-2 ring-ember/50 ring-offset-1 ring-offset-surface" : ""}`}
                />
                <span className="text-[11px] text-paper/55">
                  {weekdayNarrow.format(new Date(`${d}T00:00:00Z`))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {habit.count_label && (
        <div className="mt-3 flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-paper/10 bg-inset px-3 py-2">
            <span className="shrink-0 text-xs text-paper/70">
              {habit.kind === "quit" ? "How many today?" : "How much today?"}
            </span>
            <input
              inputMode="numeric"
              value={draft.count ?? ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                const value = raw === "" ? null : Number(raw);
                // Logging a number counts as a check-in on its own
                change(
                  {
                    count: value,
                    done:
                      value === null
                        ? latest.current.done
                        : habit.daily_limit === null
                          ? true
                          : habit.kind === "quit"
                            ? value <= habit.daily_limit
                            : value >= habit.daily_limit,
                  },
                  { debounce: true },
                );
              }}
              placeholder="0"
              aria-label={`${habit.name}: ${habit.count_label} today`}
              className="w-16 bg-transparent text-right text-lg font-semibold tabular-nums text-paper outline-none placeholder:text-paper/40"
            />
            <span className="shrink-0 text-sm text-paper/60">
              {habit.count_label}
            </span>
          </label>
          {habit.daily_limit !== null && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                draft.count === null
                  ? "text-paper/55"
                  : (habit.kind === "quit"
                        ? draft.count <= habit.daily_limit
                        : draft.count >= habit.daily_limit)
                    ? "bg-moss/15 text-moss"
                    : "bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              {habit.kind === "quit" ? "max" : "goal"} {habit.daily_limit}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={draft.done === true}
          onClick={() => change({ done: draft.done === true ? null : true })}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
            draft.done === true
              ? "border-moss bg-moss text-ink"
              : "border-paper/15 text-paper/78 hover:bg-paper/5"
          }`}
        >
          ✓ Did it
        </button>
        <button
          type="button"
          aria-pressed={draft.done === false}
          onClick={() => change({ done: draft.done === false ? null : false })}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
            draft.done === false
              ? "border-chart-expense bg-chart-expense text-white"
              : "border-paper/15 text-paper/78 hover:bg-paper/5"
          }`}
        >
          ✗ Didn&apos;t
        </button>
      </div>

      <AnimatePresence initial={false}>
        {draft.done !== null && (
          <motion.div
            key={String(draft.done)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {details ? (
                <>
                  <p className="mb-2 text-xs text-paper/70">
                    {draft.done ? "How did it feel?" : "Why not?"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {draft.done
                      ? feelingsFor(habit.kind).map((f) => (
                          <Pill
                            key={f.value}
                            selected={draft.feeling === f.value}
                            onClick={() =>
                              change({
                                feeling:
                                  draft.feeling === f.value ? null : f.value,
                              })
                            }
                          >
                            {f.emoji} {f.label}
                          </Pill>
                        ))
                      : reasonsFor(habit.kind).map((r) => (
                          <Pill
                            key={r.value}
                            selected={draft.reason === r.value}
                            onClick={() =>
                              change({
                                reason: draft.reason === r.value ? null : r.value,
                              })
                            }
                          >
                            {r.label}
                          </Pill>
                        ))}
                  </div>
                  <input
                    value={draft.note}
                    maxLength={300}
                    onChange={(e) =>
                      change({ note: e.target.value }, { debounce: true })
                    }
                    placeholder={
                      draft.done
                        ? "Anything to remember? (optional)"
                        : "What happened? (optional)"
                    }
                    className="mt-2 h-10 w-full rounded-xl border border-paper/10 bg-inset px-3 text-sm text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/60 focus:ring-4 focus:ring-ember/10"
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="min-h-10 text-left text-xs text-paper/60 transition hover:text-paper"
                >
                  {summary ?? (draft.done ? "+ How did it feel?" : "+ Why not?")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {missedNote && (
        <p className="mt-2 text-xs text-paper/60">{missedNote}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
          Couldn&apos;t save. Tap again to retry.
        </p>
      )}

      {!compact && (
        <Sheet open={menu} onClose={() => setMenu(false)} title={habit.name}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-full border border-paper/10 bg-inset p-1 text-sm">
              {(
                [
                  ["build", "Build it"],
                  ["quit", "Quit / cut down"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.kind === value}
                  onClick={() => {
                    setSettings((c) => ({ ...c, kind: value }));
                    void updateHabit(habit.id, { kind: value });
                  }}
                  className={`h-10 rounded-full px-3 font-medium transition ${
                    settings.kind === value
                      ? "bg-paper/10 text-paper"
                      : "text-paper/60 hover:text-paper"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={settings.count_label}
                maxLength={20}
                onChange={(e) =>
                  setSettings((c) => ({ ...c, count_label: e.target.value }))
                }
                onBlur={saveCount}
                placeholder="Count something? e.g. cigarettes"
                aria-label="What to count"
                className={`${fieldClass} flex-1`}
              />
              {settings.count_label.trim() && (
                <input
                  inputMode="numeric"
                  value={settings.daily_limit}
                  onChange={(e) =>
                    setSettings((c) => ({
                      ...c,
                      daily_limit: e.target.value.replace(/\D/g, "").slice(0, 4),
                    }))
                  }
                  onBlur={saveCount}
                  placeholder={settings.kind === "quit" ? "Daily max" : "Daily goal"}
                  aria-label={settings.kind === "quit" ? "Daily maximum" : "Daily goal"}
                  className={`${fieldClass} w-28`}
                />
              )}
            </div>
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                if (
                  confirm(
                    `Remove "${habit.name}"? Its check-ins are deleted too.`,
                  )
                ) {
                  setMenu(false);
                  startRemove(() => deleteHabit(habit.id));
                }
              }}
              className="mt-2 flex h-11 items-center justify-center rounded-full border border-paper/10 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
            >
              Remove habit
            </button>
          </div>
        </Sheet>
      )}
    </motion.div>
  );
}

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 rounded-full border px-3.5 text-sm transition ${
        selected
          ? "border-paper/40 bg-paper/10 text-paper"
          : "border-paper/10 text-paper/75 hover:bg-paper/5"
      }`}
    >
      {children}
    </button>
  );
}
