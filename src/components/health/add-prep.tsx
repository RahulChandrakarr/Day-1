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
    <section className="card border-ember/30 bg-ember/10 px-4 py-2.5">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium">
          Add a warm-up and a cool-down
        </p>
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
          className="h-10 shrink-0 rounded-full bg-ember px-4 text-sm font-semibold text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to my plan"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
