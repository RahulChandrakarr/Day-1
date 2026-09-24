"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addWarmupsAndStretches } from "@/app/(dashboard)/health/actions";

// Plans made before warm-ups existed can pick them up in one tap.
export default function AddPrep({ blockId }: { blockId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-card border border-ember/30 bg-ember/10 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">Add a warm-up and a cool-down</h3>
        <p className="mt-0.5 text-sm text-paper/60">
          3 quick moves to loosen up before each workout, and 3 stretches after it so
          your muscles can relax.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await addWarmupsAndStretches(blockId);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="h-11 shrink-0 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to my plan"}
      </button>
    </section>
  );
}
