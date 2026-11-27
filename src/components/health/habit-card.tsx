"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

// One habit: did it / didn't today, how it felt or why not, streak and last 7 days.
export default function HabitCard({
  habit,
  date,
  checkin,
  history,
  streak,
  compact = false,
}: {
  habit: Habit;
  date: string;
  checkin: HabitCheckin | null;
  history: HabitCheckin[]; // last 7 days for this habit
  streak: number;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>({
    done: checkin?.done ?? null,
    count: checkin?.count ?? null,
    feeling: checkin?.feeling ?? null,
    reason: checkin?.reason ?? null,
    note: checkin?.note ?? "",
  });
  const [editing, setEditing] = useState(false);
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
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className={`truncate font-medium ${compact ? "" : "text-lg"}`}>
            {habit.name}
          </h4>
          <p className="text-xs text-paper/50">
            {streak > 0 ? `🔥 ${streak} day${streak === 1 ? "" : "s"} in a row` : "No streak yet"}
          </p>
        </div>
        {!compact && (
          <ul className="flex shrink-0 gap-1" aria-label="Last 7 days">
            {days.map((d) => {
              const c = byDate.get(d);
              return (
                <li
                  key={d}
                  title={`${formatShortDate(d)}: ${c ? (c.done ? "done" : "missed") : "no check-in"}`}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span
                    className={`h-3 w-3 rounded-full ${
                      c ? (c.done ? "bg-moss" : "bg-chart-expense") : "bg-paper/10"
                    } ${d === date ? "ring-2 ring-ember/50 ring-offset-1 ring-offset-surface" : ""}`}
                  />
                  <span className="text-[9px] text-paper/35">
                    {weekdayNarrow.format(new Date(`${d}T00:00:00Z`))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {habit.count_label && (
        <div className="mt-3 flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-paper/10 bg-inset px-3 py-2">
            <span className="shrink-0 text-xs text-paper/55">
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
              className="w-16 bg-transparent text-right text-lg font-semibold tabular-nums text-paper outline-none placeholder:text-paper/25"
            />
            <span className="shrink-0 text-sm text-paper/45">
              {habit.count_label}
            </span>
          </label>
          {habit.daily_limit !== null && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                draft.count === null
                  ? "text-paper/40"
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
              : "border-paper/15 text-paper/70 hover:bg-paper/5"
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
              : "border-paper/15 text-paper/70 hover:bg-paper/5"
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
                  <p className="mb-2 text-xs text-paper/55">
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
                    className="mt-2 h-10 w-full rounded-xl border border-paper/10 bg-inset px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/60 focus:ring-4 focus:ring-ember/10"
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="text-xs text-paper/45 transition hover:text-paper"
                >
                  {summary ?? (draft.done ? "+ How did it feel?" : "+ Why not?")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {editing && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-paper/10 bg-inset p-3">
              <div className="flex rounded-full border border-paper/10 bg-inset p-0.5 text-xs">
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
                    className={`h-7 rounded-full px-3 font-medium transition ${
                      settings.kind === value
                        ? "bg-paper/10 text-paper"
                        : "text-paper/45 hover:text-paper"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <input
                value={settings.count_label}
                maxLength={20}
                onChange={(e) =>
                  setSettings((c) => ({ ...c, count_label: e.target.value }))
                }
                onBlur={() =>
                  void updateHabit(habit.id, {
                    count_label: settings.count_label,
                    daily_limit:
                      settings.daily_limit === ""
                        ? null
                        : Number(settings.daily_limit),
                  })
                }
                placeholder="Count something? e.g. cigarettes"
                className="h-8 min-w-0 flex-1 rounded-full border border-paper/10 bg-inset px-3 text-xs text-paper outline-none placeholder:text-paper/30 focus:border-ember/60"
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
                  onBlur={() =>
                    void updateHabit(habit.id, {
                      count_label: settings.count_label,
                      daily_limit:
                        settings.daily_limit === ""
                          ? null
                          : Number(settings.daily_limit),
                    })
                  }
                  placeholder={settings.kind === "quit" ? "Daily max" : "Daily goal"}
                  aria-label={settings.kind === "quit" ? "Daily maximum" : "Daily goal"}
                  className="h-8 w-24 rounded-full border border-paper/10 bg-inset px-3 text-xs text-paper outline-none placeholder:text-paper/30 focus:border-ember/60"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(error || !compact) && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs">
          <span className="mr-auto text-red-700 dark:text-red-300">
            {error && "Couldn't save. Tap again to retry."}
          </span>
          {!compact && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-lg px-2 py-1 text-paper/40 transition hover:bg-paper/5 hover:text-paper"
            >
              {editing ? "Done" : "Settings"}
            </button>
          )}
          {!compact && (
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                if (
                  confirm(
                    `Remove "${habit.name}"? Its check-ins are deleted too.`,
                  )
                )
                  startRemove(() => deleteHabit(habit.id));
              }}
              className="rounded-lg px-2 py-1 text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
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
      className={`h-8 rounded-full border px-3 text-sm transition ${
        selected
          ? "border-paper/40 bg-paper/10 text-paper"
          : "border-paper/10 text-paper/65 hover:bg-paper/5"
      }`}
    >
      {children}
    </button>
  );
}
