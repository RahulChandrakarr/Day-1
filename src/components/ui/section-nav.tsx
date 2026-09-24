"use client";

// Section navigation shared by Finance and Settings.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export type NavSection = {
  href: string;
  label: string;
  hint: string;
  icon: ReactNode;
  // A page that belongs under the section above it
  child?: boolean;
};

function useActive(sections: NavSection[]) {
  const pathname = usePathname();
  // Longest match wins, or /financial/savings would stay lit on its own
  // sub-pages as well as the child that is actually open
  const matches = sections
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0] ?? sections[0];
}

// Wide screens: a slim sidebar that can collapse to icons.
export function SectionSidebar({
  sections,
  label,
}: {
  sections: NavSection[];
  label: string;
}) {
  const active = useActive(sections);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-4 hidden shrink-0 flex-col gap-1 self-start rounded-2xl border border-paper/10 bg-surface p-2 transition-[width] duration-300 xl:flex ${
        collapsed ? "w-14" : "w-48"
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand sections" : "Collapse sections"}
        aria-expanded={!collapsed}
        className="mb-1 flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium uppercase tracking-wider text-paper/45 transition hover:bg-paper/5 hover:text-paper"
      >
        <motion.svg
          {...iconProps}
          width={16}
          height={16}
          animate={{ rotate: collapsed ? 180 : 0 }}
        >
          <path d="M15 18l-6-6 6-6" />
        </motion.svg>
        {!collapsed && "Sections"}
      </button>
      <nav aria-label={label} className="flex flex-col gap-1">
        {sections.map((s) => {
          const isActive = s.href === active.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              title={s.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm transition-colors ${
                s.child && !collapsed ? "ml-4" : ""
              } ${
                isActive
                  ? "bg-ember text-on-ember"
                  : "text-paper/60 hover:bg-paper/5 hover:text-paper"
              }`}
            >
              <span className="shrink-0">{s.icon}</span>
              {!collapsed && (
                <span className="truncate font-medium">{s.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// Smaller screens: a toggle button showing the current section, opening a drawer.
export function SectionMenuButton({
  sections,
  label,
  title,
}: {
  sections: NavSection[];
  label: string;
  title: string;
}) {
  const active = useActive(sections);
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  // Closes by itself after navigating to another section
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-label={label}
        aria-expanded={open}
        className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-paper/10 bg-surface pl-3 pr-3.5 text-sm font-semibold transition active:bg-ink xl:hidden"
      >
        <svg {...iconProps}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        {active.label}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] xl:hidden"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-paper/10 bg-surface pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] shadow-2xl xl:hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="font-serif text-2xl">{title}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-paper/50 transition hover:bg-paper/10 hover:text-paper"
                >
                  ×
                </button>
              </div>
              <nav className="flex flex-col gap-1 overflow-y-auto px-3 pb-4">
                {sections.map((s, i) => {
                  const isActive = s.href === active.href;
                  return (
                    <motion.div
                      key={s.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i }}
                    >
                      <Link
                        href={s.href}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                          s.child ? "ml-4" : ""
                        } ${
                          isActive
                            ? "bg-ember text-on-ember"
                            : "text-paper/75 hover:bg-paper/5 hover:text-paper"
                        }`}
                      >
                        <span className="shrink-0">{s.icon}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {s.label}
                          </span>
                          <span
                            className={`block truncate text-xs ${
                              isActive ? "text-on-ember/70" : "text-paper/45"
                            }`}
                          >
                            {s.hint}
                          </span>
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
