"use client";

import { useState, useTransition } from "react";
import { addHabit } from "@/app/(dashboard)/daily/actions";
import { primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import Sheet from "@/components/ui/sheet";

type Suggestion = {
  name: string;
  kind: "build" | "quit";
  count_label?: string;
  daily_limit?: number;
};

const SUGGESTIONS: Suggestion[] = [
  { name: "Quit smoking", kind: "quit", count_label: "cigarettes", daily_limit: 0 },
  { name: "Workout", kind: "build" },
  { name: "Read", kind: "build", count_label: "minutes", daily_limit: 20 },
  { name: "No sugar", kind: "quit" },
  { name: "Sleep by 11", kind: "build" },
  { name: "Water", kind: "build", count_label: "glasses", daily_limit: 8 },
];

const fieldClass =
  "h-11 min-w-0 rounded-xl border border-paper/10 bg-inset px-3 text-sm text-paper outline-none transition placeholder:text-paper/45 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

// Adding a habit is occasional, so the form waits in a sheet behind one button
export default function AddHabit({ existing }: { existing: string[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"build" | "quit">("build");
  const [countLabel, setCountLabel] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const taken = new Set(existing.map((n) => n.toLowerCase()));

  function add(value: string, options: Partial<Suggestion> = {}) {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    startTransition(async () => {
      const result = await addHabit(clean, {
        kind: options.kind ?? kind,
        count_label: options.count_label ?? countLabel,
        daily_limit:
          options.daily_limit ??
          (limit.trim() === "" ? null : Number(limit)),
      });
      if (result.ok) {
        setName("");
        setCountLabel("");
        setLimit("");
        setKind("build");
        setOpen(false);
      } else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${quietButtonClass} w-full sm:w-auto sm:self-start`}
      >
        + New habit
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New habit"
        footer={
          <button
            type="submit"
            form="add-habit"
            disabled={pending || !name.trim()}
            className={primaryButtonClass}
          >
            {pending ? "Adding…" : "Add"}
          </button>
        }
      >
        <form
          id="add-habit"
          onSubmit={(e) => {
            e.preventDefault();
            add(name);
          }}
          className="flex flex-col gap-3"
        >
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Quit smoking"
            aria-label="Habit name"
            className={`${fieldClass} w-full`}
          />
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
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className={`h-10 rounded-full px-3 font-medium transition ${
                  kind === value ? "bg-paper/10 text-paper" : "text-paper/60 hover:text-paper"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={countLabel}
              maxLength={20}
              onChange={(e) => setCountLabel(e.target.value)}
              placeholder="Count something? e.g. cigarettes"
              aria-label="What to count"
              className={`${fieldClass} flex-1`}
            />
            {countLabel.trim() && (
              <input
                inputMode="numeric"
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={kind === "quit" ? "Daily max" : "Daily goal"}
                aria-label={kind === "quit" ? "Daily maximum" : "Daily goal"}
                className={`${fieldClass} w-28`}
              />
            )}
          </div>
        </form>

        {error && (
          <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.filter((s) => !taken.has(s.name.toLowerCase())).map((s) => (
            <button
              key={s.name}
              type="button"
              disabled={pending}
              onClick={() => add(s.name, s)}
              title={
                s.count_label
                  ? `Tracks ${s.count_label} a day`
                  : "Yes / no each day"
              }
              className="h-10 rounded-full border border-dashed border-paper/20 px-3.5 text-sm text-paper/70 transition hover:border-paper/40 hover:text-paper"
            >
              + {s.name}
              {s.count_label && (
                <span className="text-paper/50"> · {s.count_label}</span>
              )}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
