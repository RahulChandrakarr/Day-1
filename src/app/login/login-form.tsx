"use client";

import {
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  type Variants,
} from "framer-motion";
import Logo from "@/components/ui/logo";
import { login, type LoginState } from "./actions";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const noopSubscribe = () => () => {};

function greeting(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const shake = useAnimationControls();

  // Only read the date on the client so it matches the visitor's timezone.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const now = isClient ? new Date() : null;

  useEffect(() => {
    if (state.error) {
      shake.start({
        x: [0, -10, 10, -6, 6, -2, 0],
        transition: { duration: 0.45 },
      });
    }
  }, [state, shake]);

  return (
    <main className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-10 text-paper">
      {/* Drifting light, kept behind the glass card so the card frosts it */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full bg-[#f6d9c4]/60 blur-3xl"
        animate={{ x: [0, 80, 0], y: [0, 60, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-32 -z-10 h-[30rem] w-[30rem] rounded-full bg-[#efc6bd]/55 blur-3xl"
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative grid w-full max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_1fr] md:gap-20"
      >
        {/* Left: the journal cover */}
        <section className="flex flex-col gap-6">
          <motion.div variants={item} className="flex items-center gap-3">
            <Logo className="h-11 w-auto" priority />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-paper/78">
              Life tracker
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="font-bold tracking-tight text-5xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            {now ? greeting(now.getHours()) : "Welcome back"}.
            <br />
            <span className="italic">Let&apos;s begin.</span>
          </motion.h1>

          <motion.div variants={item} className="h-6">
            <AnimatePresence>
              {now && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-lg text-paper/80"
                >
                  {now.toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.ul
            variants={item}
            className="mt-2 hidden flex-wrap gap-2 text-sm text-paper/80 md:flex"
          >
            {["Daily tasks", "Habits", "Money", "Notes"].map((label, i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                className="rounded-full border border-glass-edge bg-glass px-3 py-1 backdrop-blur-md"
              >
                {label}
              </motion.li>
            ))}
          </motion.ul>
        </section>

        {/* Right: sign in card */}
        <motion.section variants={item}>
          <motion.div
            animate={shake}
            className="card glass-strong rounded-[28px] p-6 shadow-2xl shadow-[rgb(120_90_70/0.25)] dark:shadow-black/40 sm:p-8"
          >
            <h2 className="font-bold tracking-tight text-3xl">Sign in</h2>
            <p className="mt-1 text-sm text-paper/65">
              Pick up where you left off.
            </p>

            <form action={action} className="mt-8 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-paper/65">
                  Email
                </span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-12 rounded-xl border border-paper/10 bg-inset px-3 text-paper outline-none transition placeholder:text-paper/40 focus:border-ember/70 focus:ring-4 focus:ring-ember/15"
                  placeholder="you@example.com"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-paper/65">
                  Password
                </span>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="h-12 w-full rounded-xl border border-paper/10 bg-inset px-3 pr-16 text-paper outline-none transition placeholder:text-paper/40 focus:border-ember/70 focus:ring-4 focus:ring-ember/15"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs text-paper/65 transition hover:bg-paper/10 hover:text-paper"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <AnimatePresence mode="wait">
                {state.error && (
                  <motion.p
                    key={state.error}
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
                  >
                    {state.error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={pending}
                whileHover={{ scale: pending ? 1 : 1.015 }}
                whileTap={{ scale: 0.98 }}
                className="relative mt-2 flex h-12 items-center justify-center overflow-hidden rounded-xl bg-ember font-medium text-on-ember transition-colors hover:bg-ember-light disabled:cursor-wait disabled:opacity-80"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {pending ? (
                    <motion.span
                      key="pending"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-2"
                    >
                      <motion.span
                        className="h-4 w-4 rounded-full border-2 border-on-ember/30 border-t-on-ember"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                      Opening journal…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      Continue →
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </form>
          </motion.div>

          <p className="mt-4 text-center text-xs text-paper/45">
            Invite only. Ask your admin for access.
          </p>
        </motion.section>
      </motion.div>
    </main>
  );
}
