"use client";

import { useActionState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addUser, type AddUserState } from "./actions";

const inputClass =
  "h-11 rounded-xl border border-paper/10 bg-ink px-3 text-paper outline-none transition placeholder:text-paper/25 focus:border-ember/70 focus:ring-4 focus:ring-ember/15";

export default function AddUserForm() {
  const [state, action, pending] = useActionState<AddUserState, FormData>(
    addUser,
    { error: null, success: null },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  const message = state.error ?? state.success;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-paper/10 bg-paper/[0.04] p-6 md:sticky md:top-8"
    >
      <h2 className="font-serif text-2xl">Add someone</h2>
      <p className="mt-1 text-sm text-paper/50">They join as a regular user.</p>

      <form ref={formRef} action={action} className="mt-6 flex flex-col gap-4">
        <input
          name="full_name"
          placeholder="Name (optional)"
          className={inputClass}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="off"
          className={inputClass}
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          autoComplete="new-password"
          className={inputClass}
        />

        <AnimatePresence mode="wait">
          {message && (
            <motion.p
              key={message}
              role={state.error ? "alert" : "status"}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`overflow-hidden rounded-lg px-3 py-2 text-sm ${
                state.error
                  ? "bg-red-500/10 text-red-700 dark:text-red-300"
                  : "bg-moss/15 text-moss"
              }`}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={pending}
          whileTap={{ scale: 0.98 }}
          className="h-11 rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Adding…" : "Add user"}
        </motion.button>
      </form>
    </motion.section>
  );
}
