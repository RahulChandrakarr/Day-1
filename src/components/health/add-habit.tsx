"use client";

import { useState, useTransition } from "react";
import { addHabit } from "@/app/(dashboard)/daily/actions";

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

export default function AddHabit({ existing }: { existing: string[] }) {
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
      } else setError(result.error);
    });
  }

  return (
    <section className="rounded-[18px] border border-paper/10 bg-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(name);
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a habit to track, e.g. Quit smoking"
          className="h-11 min-w-0 flex-1 rounded-xl border border-paper/10 bg-ink px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="h-11 shrink-0 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-paper/10 bg-ink p-0.5 text-xs">
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
              className={`h-7 rounded-full px-3 font-medium transition ${
                kind === value ? "bg-paper/10 text-paper" : "text-paper/45 hover:text-paper"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <input
          value={countLabel}
          maxLength={20}
          onChange={(e) => setCountLabel(e.target.value)}
          placeholder="Count something? e.g. cigarettes"
          className="h-8 min-w-0 flex-1 rounded-full border border-paper/10 bg-ink px-3 text-xs text-paper outline-none placeholder:text-paper/30 focus:border-ember/60"
        />
        {countLabel.trim() && (
          <input
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={kind === "quit" ? "Daily max" : "Daily goal"}
            aria-label={kind === "quit" ? "Daily maximum" : "Daily goal"}
            className="h-8 w-24 rounded-full border border-paper/10 bg-ink px-3 text-xs text-paper outline-none placeholder:text-paper/30 focus:border-ember/60"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
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
            className="rounded-full border border-dashed border-paper/20 px-2.5 py-1 text-xs text-paper/55 transition hover:border-paper/40 hover:text-paper"
          >
            + {s.name}
            {s.count_label && (
              <span className="text-paper/35"> · {s.count_label}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
