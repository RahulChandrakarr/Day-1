"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  addHabit,
  deleteHabit,
  saveJournal,
} from "@/app/(dashboard)/daily/actions";
import { saveHabitCheckin } from "@/app/(dashboard)/health/actions";
import {
  ENERGY,
  MOODS,
  type Habit,
  type JournalEntry,
} from "@/lib/journal";
import VoiceInput from "./voice-input";
import { Card as Shell, CardHead } from "@/components/ui/kit";

type Status = "idle" | "pending" | "saving" | "saved" | "error";

const SAVE_DELAY = 900;

const fieldClass =
  "w-full rounded-xl border border-paper/10 bg-inset px-3 py-2.5 text-[15px] text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/60 focus:ring-4 focus:ring-ember/10";

export default function JournalEditor({
  initial,
  exists,
  habits: initialHabits,
  doneHabitIds,
  isToday,
}: {
  initial: JournalEntry;
  exists: boolean;
  habits: Habit[];
  doneHabitIds: string[];
  isToday: boolean;
}) {
  // Habit ticks are shared with Health & Habits, so they save on their own
  const [habitsDone, setHabitsDone] = useState(doneHabitIds);
  const router = useRouter();
  const created = useRef(exists);
  const [entry, setEntry] = useState(initial);
  const [habits, setHabits] = useState(initialHabits);
  const [status, setStatus] = useState<Status>("idle");
  const latest = useRef(entry);
  const timer = useRef<number | null>(null);

  async function save(next: JournalEntry) {
    timer.current = null;
    setStatus("saving");
    try {
      const result = await saveJournal(next);
      // A newer edit may already be waiting; let that one report its status
      // The first save creates the day's page: refresh so reminders clear
      if (result.ok && !created.current) {
        created.current = true;
        router.refresh();
      }
      if (timer.current) return;
      setStatus(result.ok ? "saved" : "error");
    } catch {
      if (!timer.current) setStatus("error");
    }
  }

  function update(patch: Partial<JournalEntry>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setEntry(next);
    setStatus("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(next), SAVE_DELAY);
  }

  // Leaving the page (or switching day) saves anything not yet sent
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        void saveJournal(latest.current);
      }
    },
    [],
  );

  // Stable keys so rows animate correctly when added or removed mid-list
  const [priorityKeys, setPriorityKeys] = useState(() =>
    initial.priorities.map(() => crypto.randomUUID()),
  );
  const priorityInputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusRow = useRef<number | null>(null);

  useEffect(() => {
    if (focusRow.current === null) return;
    priorityInputs.current[focusRow.current]?.focus();
    focusRow.current = null;
  }, [priorityKeys]);

  function updatePriorities(priorities: JournalEntry["priorities"]) {
    update({ priorities });
  }

  function addPriority(at: number) {
    if (entry.priorities.length >= 50) return;
    const priorities = [...entry.priorities];
    priorities.splice(at, 0, { text: "", done: false });
    const keys = [...priorityKeys];
    keys.splice(at, 0, crypto.randomUUID());
    focusRow.current = at;
    setPriorityKeys(keys);
    update({ priorities });
  }

  function removePriority(at: number) {
    const priorities = entry.priorities.filter((_, j) => j !== at);
    const keys = priorityKeys.filter((_, j) => j !== at);
    // Always keep one row to type into
    if (priorities.length === 0) {
      priorities.push({ text: "", done: false });
      keys.push(crypto.randomUUID());
    }
    focusRow.current = Math.max(at - 1, 0);
    setPriorityKeys(keys);
    update({ priorities });
  }

  const filledPriorities = entry.priorities.filter((p) => p.text);
  const doneCount = filledPriorities.filter((p) => p.done).length;


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-paper/65">
          {isToday ? "Write as the day goes." : "Looking back on this day."}
        </p>
        <SaveStatus
          status={status}
          onRetry={() => void save(latest.current)}
        />
      </div>

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card title="How was today?">
            <div className="grid grid-cols-5 gap-1.5">
              {MOODS.map((m) => {
                const active = entry.mood === m.value;
                return (
                  <motion.button
                    key={m.value}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    aria-pressed={active}
                    onClick={() => update({ mood: active ? null : m.value })}
                    className={`flex flex-col items-center gap-1 rounded-2xl border py-2 transition ${
                      active
                        ? "border-ember/60 bg-ember/15"
                        : "border-paper/10 hover:bg-paper/5"
                    }`}
                  >
                    <span
                      className={`text-2xl transition ${active ? "" : "grayscale-[40%]"}`}
                    >
                      {m.emoji}
                    </span>
                    <span className="text-[11px] text-paper/72">{m.label}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between text-xs">
                <span className="font-medium uppercase tracking-wider text-paper/65">
                  Energy
                </span>
                <span className="text-paper/70">
                  {entry.energy ? ENERGY[entry.energy - 1] : "Tap to set"}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ENERGY.map((label, i) => {
                  const level = i + 1;
                  const filled = (entry.energy ?? 0) >= level;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-label={`Energy: ${label}`}
                      aria-pressed={entry.energy === level}
                      onClick={() =>
                        update({ energy: entry.energy === level ? null : level })
                      }
                      className={`h-3 rounded-full transition-colors ${
                        filled ? "bg-moss" : "bg-paper/10 hover:bg-paper/20"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </Card>

          <Card
            title="Priorities"
            aside={
              filledPriorities.length
                ? `${doneCount}/${filledPriorities.length} done`
                : undefined
            }
          >
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {entry.priorities.map((p, i) => (
                  <motion.li
                    key={priorityKeys[i]}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex items-center gap-2"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={p.done}
                      aria-label={`Mark priority ${i + 1} done`}
                      disabled={!p.text}
                      onClick={() =>
                        updatePriorities(
                          entry.priorities.map((q, j) =>
                            j === i ? { ...q, done: !q.done } : q,
                          ),
                        )
                      }
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                        p.done
                          ? "border-moss bg-moss text-ink"
                          : "border-paper/25 hover:border-paper/50 disabled:opacity-40"
                      }`}
                    >
                      {p.done && <CheckIcon />}
                    </button>
                    <input
                      ref={(el) => {
                        priorityInputs.current[i] = el;
                      }}
                      value={p.text}
                      maxLength={200}
                      onChange={(e) =>
                        updatePriorities(
                          entry.priorities.map((q, j) =>
                            j === i
                              ? {
                                  text: e.target.value,
                                  done: e.target.value ? q.done : false,
                                }
                              : q,
                          ),
                        )
                      }
                      onKeyDown={(e) => {
                        // Enter adds a row below; Backspace on an empty row removes it
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPriority(i + 1);
                        } else if (
                          e.key === "Backspace" &&
                          !p.text &&
                          entry.priorities.length > 1
                        ) {
                          e.preventDefault();
                          removePriority(i);
                        }
                      }}
                      placeholder={i === 0 ? "Most important thing" : "Another priority"}
                      className={`${fieldClass} ${p.done ? "text-paper/60 line-through" : ""}`}
                    />
                    <button
                      type="button"
                      aria-label={`Remove priority ${i + 1}`}
                      onClick={() => removePriority(i)}
                      className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-paper/45 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:text-red-300"
                    >
                      ×
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <button
              type="button"
              onClick={() => addPriority(entry.priorities.length)}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-paper/20 text-sm text-paper/70 transition hover:border-paper/40 hover:text-paper"
            >
              + Add priority
            </button>
          </Card>

          <HabitsCard
            habits={habits}
            done={habitsDone}
            summary={
              habits.length
                ? `${habits.filter((h) => habitsDone.includes(h.id)).length}/${habits.length}`
                : undefined
            }
            onToggle={(id) => {
              const done = !habitsDone.includes(id);
              setHabitsDone((list) =>
                done ? [...list, id] : list.filter((h) => h !== id),
              );
              void saveHabitCheckin({
                habitId: id,
                date: entry.entry_date,
                done: done ? true : null,
              });
            }}
            onAdded={(habit) => setHabits((list) => [...list, habit])}
            onRemoved={(id) => {
              setHabits((list) => list.filter((h) => h.id !== id));
              setHabitsDone((list) => list.filter((h) => h !== id));
            }}
          />

          <Card title="Grateful for">
            <ol className="flex flex-col gap-2">
              {entry.gratitude.map((g, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm text-paper/50">
                    {i + 1}
                  </span>
                  <input
                    value={g}
                    maxLength={300}
                    onChange={(e) =>
                      update({
                        gratitude: entry.gratitude.map((x, j) =>
                          j === i ? e.target.value : x,
                        ),
                      })
                    }
                    placeholder={
                      ["Someone who helped", "A small moment", "Something you have"][i]
                    }
                    className={fieldClass}
                  />
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Card title="Notes">
            <div className="relative">
              <AutoTextarea
                value={entry.notes}
                maxLength={20000}
                minRows={8}
                onChange={(notes) => update({ notes })}
                placeholder="What happened today? Type, or tap the mic and speak in English or Hindi…"
                className="pb-[4.5rem]"
              />
              <div className="absolute bottom-2 right-2 left-2 flex justify-end">
                <VoiceInput
                  onText={(spoken) => {
                    const current = latest.current.notes;
                    const joiner = !current || /\s$/.test(current) ? "" : " ";
                    update({ notes: `${current}${joiner}${spoken}`.slice(0, 20000) });
                  }}
                />
              </div>
            </div>
          </Card>

          <details className="group card p-4">
            <summary className="cursor-pointer list-none font-bold tracking-tight text-xl">
              Wins, lessons and tomorrow
              <span className="ml-2 text-sm text-paper/55 group-open:hidden">
                tap to write
              </span>
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-paper/70">Wins</p>
                  <AutoTextarea
                    value={entry.wins}
                    maxLength={2000}
                    minRows={3}
                    onChange={(wins) => update({ wins })}
                    placeholder="What went well?"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-paper/70">
                    Lessons
                  </p>
                  <AutoTextarea
                    value={entry.lessons}
                    maxLength={2000}
                    minRows={3}
                    onChange={(lessons) => update({ lessons })}
                    placeholder="What did you learn?"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-paper/70">
                  Tomorrow
                </p>
                <AutoTextarea
                  value={entry.tomorrow}
                  maxLength={2000}
                  minRows={2}
                  onChange={(tomorrow) => update({ tomorrow })}
                  placeholder="One or two things to start with tomorrow"
                />
              </div>
            </div>
          </details>

        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <Shell>
      <CardHead title={title} aside={aside} />
      {children}
    </Shell>
  );
}

function HabitsCard({
  habits,
  done,
  summary,
  onToggle,
  onAdded,
  onRemoved,
}: {
  habits: Habit[];
  done: string[];
  summary?: string;
  onToggle: (id: string) => void;
  onAdded: (habit: Habit) => void;
  onRemoved: (id: string) => void;
}) {
  const [editing, setEditing] = useState(habits.length === 0);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    const value = name.trim();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const result = await addHabit(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdded(result.habit);
      setName("");
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-bold tracking-tight text-xl sm:text-2xl">Habits</h3>
        <div className="flex items-baseline gap-3">
          {summary && <span className="text-xs text-paper/65">{summary}</span>}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-ember hover:underline"
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {habits.length === 0 && !editing && (
        <p className="text-sm text-paper/60">No habits yet.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {habits.map((h) => {
          const checked = done.includes(h.id);
          return (
            <div key={h.id} className="flex items-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(h.id)}
                className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition ${
                  checked
                    ? "border-moss/50 bg-moss/15 text-paper"
                    : "border-paper/10 text-paper/78 hover:bg-paper/5"
                } ${editing ? "rounded-r-none border-r-0" : ""}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    checked ? "border-moss bg-moss text-ink" : "border-paper/30"
                  }`}
                >
                  {checked && <CheckIcon size={10} />}
                </span>
                {h.name}
              </motion.button>
              {editing && (
                <button
                  type="button"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => {
                    if (confirm(`Remove "${h.name}" from your habits?`)) {
                      onRemoved(h.id);
                      startTransition(() => deleteHabit(h.id));
                    }
                  }}
                  className="flex h-9 w-8 items-center justify-center rounded-r-full border border-paper/10 text-paper/55 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-3">
              <input
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="Add a habit, e.g. Workout, Read 20 min"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={add}
                disabled={pending || !name.trim()}
                className="shrink-0 rounded-xl bg-ember px-4 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  minRows,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  minRows: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the text instead of scrolling inside the box
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${fieldClass} resize-none leading-relaxed ${className}`}
    />
  );
}

function SaveStatus({
  status,
  onRetry,
}: {
  status: Status;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300"
      >
        Couldn&apos;t save · Retry
      </button>
    );
  }
  const label =
    status === "pending" || status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : null;
  return (
    <AnimatePresence mode="wait">
      {label && (
        <motion.span
          key={label}
          role="status"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`flex items-center gap-1.5 text-xs font-medium ${
            label === "Saved" ? "text-moss" : "text-paper/65"
          }`}
        >
          {label === "Saved" && <CheckIcon size={12} />}
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
