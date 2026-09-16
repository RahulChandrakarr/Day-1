"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteGoal, saveGoal } from "@/app/(dashboard)/plan/actions";
import VoiceInput from "@/components/journal/voice-input";
import Sheet from "@/components/ui/sheet";
import { Field, inputClass, primaryButtonClass } from "@/components/ui/kit";
import type { PlanGoal } from "@/lib/plans";

const EMOJIS = ["🎯", "💰", "💪", "📚", "💻", "🧘", "✈️", "🏠", "❤️", "🎨", "🚭", "📈"];
const UNITS = ["₹", "kg", "books", "km", "hours", "days", "%"];

// Create or edit a yearly goal: name, notes, optional number to reach.
export default function GoalSheet({
  year,
  goal,
  trigger,
}: {
  year: number;
  goal?: PlanGoal;
  trigger: (open: () => void) => React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [target, setTarget] = useState(
    goal?.target_value ? String(goal.target_value) : "",
  );
  const [unit, setUnit] = useState(goal?.unit ?? "₹");
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
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (!goal) {
        setTitle("");
        setNotes("");
        setTarget("");
      }
      router.refresh();
    });
  }

  function remove() {
    if (!goal || !confirm(`Delete "${goal.title}" and its whole breakdown?`)) return;
    startTransition(async () => {
      const result = await deleteGoal(goal.id);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <>
      {trigger(() => setOpen(true))}
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
                className="h-12 rounded-2xl px-4 text-sm text-paper/50 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
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
          <p className="-mt-2 text-xs text-paper/40">
            With a number, progress follows what you log. Without one, it
            follows the tasks you tick.
          </p>

          <Field label="Plan notes" hint="what and how">
            <div className="relative">
              <textarea
                value={notes}
                rows={8}
                maxLength={20000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={"Why this matters, the approach, milestones, rules…\n\n• Q1: …\n• Q2: …"}
                className={`${inputClass} h-auto resize-y py-2.5 pb-16 leading-relaxed`}
              />
              <div className="absolute bottom-2 left-2 right-2 flex justify-end">
                <VoiceInput
                  onText={(spoken) =>
                    setNotes((current) =>
                      `${current}${current && !/\s$/.test(current) ? " " : ""}${spoken}`.slice(0, 20000),
                    )
                  }
                />
              </div>
            </div>
          </Field>

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
