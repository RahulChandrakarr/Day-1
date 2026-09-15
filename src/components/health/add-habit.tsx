"use client";

import { useState, useTransition } from "react";
import { addHabit } from "@/app/(dashboard)/daily/actions";

const SUGGESTIONS = ["Quit smoking", "Workout", "Read 20 min", "No sugar", "Sleep by 11", "Drink 3L water"];

export default function AddHabit({ existing }: { existing: string[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const taken = new Set(existing.map((n) => n.toLowerCase()));

  function add(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setError(null);
    startTransition(async () => {
      const result = await addHabit(clean);
      if (result.ok) setName("");
      else setError(result.error);
    });
  }

  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-4 sm:p-5">
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
          className="h-11 min-w-0 flex-1 rounded-xl border border-paper/10 bg-ink/60 px-3 text-sm text-paper outline-none transition placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="h-11 shrink-0 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase())).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => add(s)}
            className="rounded-full border border-dashed border-paper/20 px-2.5 py-1 text-xs text-paper/55 transition hover:border-paper/40 hover:text-paper"
          >
            + {s}
          </button>
        ))}
      </div>
    </section>
  );
}
