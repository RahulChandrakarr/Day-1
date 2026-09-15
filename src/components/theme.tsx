"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "theme";

// Runs before first paint so the page never flashes the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}})()`;

export function ThemeScript() {
  return (
    <script
      // Only executes from the server HTML; ignored when React renders on the client.
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => null,
  );
}

const sun = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const moon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export function ThemeToggle({
  className = "",
  labelClassName,
}: {
  className?: string;
  /** Renders a text label with these classes; omit for icon only. */
  labelClassName?: string;
}) {
  const isDark = useIsDark();

  function toggle() {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.add("theme-transition");
    root.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode); the theme still applies for this visit.
    }
    window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  }

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex items-center gap-3 overflow-hidden text-paper/60 transition-colors hover:text-paper ${className}`}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {isDark !== null && (
            <motion.span
              key={isDark ? "moon" : "sun"}
              initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute"
            >
              {isDark ? moon : sun}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {labelClassName !== undefined && (
        <span className={labelClassName}>
          {isDark === false ? "Dark mode" : "Light mode"}
        </span>
      )}
    </button>
  );
}
