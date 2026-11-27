"use client";

import { useId, useRef, useState, useTransition } from "react";
import { deleteGoal, saveGoal } from "@/app/(dashboard)/plan/actions";
import VoiceInput, { joinSpoken } from "@/components/journal/voice-input";
import Sheet from "@/components/ui/sheet";
import { Field, inputClass, labelClass, primaryButtonClass } from "@/components/ui/kit";

// Buttons that open the sheet (a server page can't pass a render function)
const TRIGGERS = {
  primary: primaryButtonClass,
  link: "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-ember hover:bg-ember/10",
};
import { MONTH_NAMES, type PlanGoal } from "@/lib/plans";

const EMOJIS = ["🎯", "💰", "💪", "📚", "💻", "🧘", "✈️", "🏠", "❤️", "🎨", "🚭", "📈"];
const UNITS = ["₹", "kg", "books", "km", "hours", "days", "%"];

// Create or edit a yearly goal: name, notes, optional number to reach.
export default function GoalSheet({
  year,
  goal,
  label,
  variant = "primary",
}: {
  year: number;
  goal?: PlanGoal;
  label: string;
  variant?: keyof typeof TRIGGERS;
}) {
  const [open, setOpen] = useState(false);
  const notesBox = useRef<HTMLTextAreaElement>(null);
  const notesId = useId();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [target, setTarget] = useState(
    goal?.target_value ? String(goal.target_value) : "",
  );
  const [unit, setUnit] = useState(goal?.unit ?? "₹");
  // New goals start this month when planning the current year
  const thisYear = new Date().getFullYear() === year;
  const [startMonth, setStartMonth] = useState(
    goal?.start_month ?? (thisYear ? new Date().getMonth() + 1 : 1),
  );
  const [endMonth, setEndMonth] = useState(goal?.end_month ?? 12);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveGoal({
        id: goal?.id,
        year,
        title,
        emoji,
        notes,
        target_value: target,
        unit,
        start_month: startMonth,
        end_month: endMonth,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // saveGoal re-renders the page with the reply, so it is already fresh
      setOpen(false);
      if (!goal) {
        setTitle("");
        setNotes("");
        setTarget("");
      }
    });
  }

  function remove() {
    if (!goal || !confirm(`Delete "${goal.title}" and its whole breakdown?`)) return;
    startTransition(async () => {
      const result = await deleteGoal(goal.id);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={TRIGGERS[variant]}
      >
        {label}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={goal ? "Edit goal" : `New goal for ${year}`}
        wide
        footer={
          <div className="flex gap-2">
            {goal && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="h-12 rounded-2xl px-4 text-sm text-paper/65 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending || !title.trim()}
              className={primaryButtonClass}
            >
              {pending ? "Saving…" : goal ? "Save changes" : "Add goal"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(e)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                  emoji === e ? "bg-ember/15 ring-2 ring-ember/50" : "hover:bg-paper/5"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <Field label="Goal">
            <input
              autoFocus={!goal}
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Save ₹2 lakh, Learn React, Lose 8 kg…"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Starts">
              <select
                value={startMonth}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setStartMonth(value);
                  if (value > endMonth) setEndMonth(value);
                }}
                className={inputClass}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name} {year}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ends">
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(Number(e.target.value))}
                className={inputClass}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1} disabled={i + 1 < startMonth}>
                    {name} {year}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-paper/55">
            {endMonth - startMonth + 1} month
            {endMonth - startMonth === 0 ? "" : "s"}. Monthly targets and tasks
            are spread across these months only.
          </p>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Number to reach" hint="(optional)">
              <input
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="200000"
                className={`${inputClass} tabular-nums`}
              />
            </Field>
            <Field label="Unit">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={!target}
                className={`${inputClass} w-24`}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-paper/55">
            With a number, progress follows what you log. Without one, it
            follows the tasks you tick.
          </p>

          {/* The mic sits on the label's row, not over the text, so it never
              covers what you're writing or moves as the notes grow */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <label htmlFor={notesId} className={`${labelClass} shrink-0`}>
                Plan notes <span className="ml-1 text-paper/50">what and how</span>
              </label>
              <VoiceInput
                onText={(spoken) => {
                  setNotes((current) => joinSpoken(current, spoken).slice(0, 20000));
                  // Show the words as they land at the end of the box
                  requestAnimationFrame(() => {
                    const box = notesBox.current;
                    if (box) box.scrollTop = box.scrollHeight;
                  });
                }}
              />
            </div>
            <textarea
              id={notesId}
              ref={notesBox}
              value={notes}
              rows={7}
              maxLength={20000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={"Why this matters, the approach, milestones, rules…\n\n• Q1: …\n• Q2: …"}
              className={`${inputClass} h-auto resize-y py-2.5 leading-relaxed`}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
