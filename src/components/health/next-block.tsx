"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startNextBlock } from "@/app/(dashboard)/health/actions";

// Shown when a block has finished: build the next month from the same profile.
export default function NextBlock({
  blockNumber,
  summary,
}: {
  blockNumber: number;
  summary: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-3xl border border-ember/40 bg-ember/10 p-5 sm:p-6">
      <h3 className="font-bold tracking-tight text-2xl">Month {blockNumber} complete 🎉</h3>
      <p className="mt-1 max-w-xl text-sm text-paper/65">{summary}</p>
      <ul className="mt-3 flex flex-col gap-1 text-sm text-paper/60">
        <li>• Some exercises change, so your body keeps adapting</li>
        <li>• Weeks 1–3 get harder again, week 4 is a lighter deload</li>
        <li>• Your finished workouts stay in the history</li>
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startNextBlock();
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="mt-4 h-11 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
      >
        {pending ? "Building…" : `Start month ${blockNumber + 1}`}
      </button>
    </section>
  );
}
