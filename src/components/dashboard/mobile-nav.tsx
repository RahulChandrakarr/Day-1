"use client";

import Link from "next/link";
import Avatar from "./avatar";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme";
import Logo from "@/components/ui/logo";
import type { Profile } from "@/lib/auth";
import { isActive, logoutIcon, navItems, settingsIcon, usersIcon } from "./nav";

// Phones: app-style top bar plus a bottom tab bar.
export default function MobileNav({
  profile,
  avatarUrl = null,
  alerts = [],
}: {
  profile: Profile;
  avatarUrl?: string | null;
  alerts?: string[];
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = profile.full_name || profile.email.split("@")[0];
  const current =
    navItems.find((item) => isActive(pathname, item.href))?.label ??
    (pathname.startsWith("/settings")
      ? "Settings"
      : pathname.startsWith("/admin")
        ? "Users"
        : null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-glass-edge bg-glass px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] backdrop-blur-2xl backdrop-saturate-150 md:hidden">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-auto" priority />
          <AnimatePresence mode="wait" initial={false}>
            {current && (
              <motion.span
                key={current}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="font-bold tracking-tight text-2xl"
              >
                {current}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div ref={menuRef} className="relative flex items-center gap-2">
          <ThemeToggle className="h-9 w-9 justify-center rounded-full hover:bg-paper/10" />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-paper/10 text-sm font-medium"
          >
            <Avatar url={avatarUrl} name={name} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-56 origin-top-right card glass-strong p-2 shadow-2xl shadow-black/10 dark:shadow-black/50"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-paper/40">
                    {profile.email}
                  </p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-paper/70 hover:bg-paper/5 hover:text-paper"
                >
                  {settingsIcon}
                  Settings
                </Link>
                {profile.role === "admin" && (
                  <Link
                    href="/admin/users"
                    onClick={() => setMenuOpen(false)}
                    className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-paper/70 hover:bg-paper/5 hover:text-paper"
                  >
                    {usersIcon}
                    Manage users
                  </Link>
                )}
                <form action={logout}>
                  <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-paper/70 hover:bg-paper/5 hover:text-paper">
                    {logoutIcon}
                    Sign out
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* A floating glass bar, clear of the screen edges */}
      <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-30 md:hidden">
        <ul className="glass-panel mx-auto grid max-w-lg grid-cols-6 gap-0.5 rounded-[26px] p-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10.5px] transition-colors ${
                    active ? "font-semibold text-ember" : "text-paper/55"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-active"
                      className="absolute inset-0 rounded-[20px] bg-surface/90 shadow-[0_6px_16px_-8px_rgb(120_90_70/0.4)] dark:bg-white/[0.12] dark:shadow-none"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <motion.span
                    animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
                    whileTap={{ scale: 0.85 }}
                    className="relative"
                  >
                    {item.icon}
                    {alerts.includes(item.href) && !active && (
                      <span
                        aria-label="Reminder"
                        className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-ember"
                      />
                    )}
                  </motion.span>
                  <span className="relative font-medium">{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
