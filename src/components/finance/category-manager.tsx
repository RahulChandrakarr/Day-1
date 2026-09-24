"use client";

import { useActionState, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addCategory,
  deleteCategory,
  type FormState,
} from "@/app/(dashboard)/financial/actions";
import type { Category, TxType } from "@/lib/finance";

const COLORS = [1, 2, 3, 4, 5, 6, 7, 8];

function Chip({ category }: { category: Category }) {
  const [pending, startTransition] = useTransition();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: pending ? 0.4 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex h-9 items-center gap-2 rounded-full border border-paper/10 pl-3 pr-1 text-sm"
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: `var(--cat-${category.color})` }}
      />
      {category.name}
      <button
        type="button"
        disabled={pending}
        aria-label={`Delete ${category.name}`}
        onClick={() => {
          if (
            confirm(
              `Delete "${category.name}"? Its entries stay but become uncategorized.`,
            )
          )
            startTransition(() => deleteCategory(category.id));
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-paper/35 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
      >
        ×
      </button>
    </motion.li>
  );
}

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>("expense");
  const [color, setColor] = useState(1);
  const [state, action, pending] = useActionState<FormState, FormData>(
    addCategory,
    { error: null, ok: false, version: 0 },
  );

  return (
    <section
      id="categories"
      className="scroll-mt-24 rounded-card border border-paper/10 bg-surface p-4"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-serif text-2xl">Categories</h3>
          <p className="mt-0.5 text-sm text-paper/50">
            {categories.length} categories · group your entries
          </p>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/10 text-paper/60"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-6 pt-6 md:grid-cols-2">
              {(["expense", "income"] as const).map((t) => (
                <div key={t}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-paper/50">
                    {t}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    <AnimatePresence initial={false}>
                      {categories
                        .filter((c) => c.type === t)
                        .map((c) => (
                          <Chip key={c.id} category={c} />
                        ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))}
            </div>

            <form
              key={state.ok ? state.version : "draft"}
              action={action}
              className="mt-6 flex flex-col gap-3 border-t border-paper/10 pt-5 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="color" value={color} />
              <input
                name="name"
                required
                maxLength={40}
                placeholder="New category name"
                defaultValue={state.ok ? "" : state.values?.name}
                className="h-10 flex-1 rounded-xl border border-paper/10 bg-ink px-3 text-paper outline-none placeholder:text-paper/30 focus:border-ember/70 focus:ring-4 focus:ring-ember/15 sm:min-w-48"
              />
              <div className="flex gap-1 rounded-xl border border-paper/10 p-1">
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={`h-8 rounded-lg px-3 text-sm capitalize transition ${
                      type === t
                        ? "bg-paper/10 text-paper"
                        : "text-paper/50 hover:text-paper"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div
                className="flex gap-1.5"
                role="radiogroup"
                aria-label="Color"
              >
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition ${
                      color === c ? "ring-2 ring-paper/70" : ""
                    }`}
                    style={{ background: `var(--cat-${c})` }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-xl bg-ember px-4 text-sm font-medium text-on-ember transition hover:bg-ember-light disabled:opacity-70"
              >
                {pending ? "Adding…" : "Add"}
              </button>
              {state.error && (
                <p
                  role="alert"
                  className="w-full text-sm text-red-700 dark:text-red-300"
                >
                  {state.error}
                </p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
