"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useAddHub } from "./add-hub";
import { isActive, navItems, type NavItem } from "./nav";
import { AlertDot, useTapped } from "./nav-state";

// Phones: no top bar, so each page starts at the top of the screen. The six
// sections sit in a floating bar at the bottom, three either side of a raised
// Add button that opens the Add menu (money, to-do, note, health). The profile
// photo on the Home page leads to Profile and the rest of Settings.
export default function MobileNav({
  alerts,
}: {
  // Tabs that want attention; it arrives after the bar itself (see AlertDot)
  alerts: Promise<string[]>;
}) {
  const pathname = usePathname();
  const [tapped, tap] = useTapped(pathname);
  const { openMenu } = useAddHub();
  const half = Math.ceil(navItems.length / 2);

  const tab = (item: NavItem) => {
    const active = tapped ? item.href === tapped : isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onNavigate={() => tap(item.href)}
          aria-current={active ? "page" : undefined}
          className={`relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10.5px] transition-colors ${
            active ? "font-semibold text-ember" : "text-paper/70"
          }`}
        >
          {active && (
            // The white tile behind the current tab; it slides between tabs
            <motion.span
              layoutId="bottom-nav-active"
              className="absolute inset-0 rounded-[20px] bg-surface/90 shadow-[0_6px_16px_-8px_rgb(120_90_70/0.4)] dark:bg-white/[0.12] dark:shadow-none"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <motion.span
            animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
            whileTap={{ scale: 0.85 }}
            className="relative"
          >
            {item.icon}
            {!active && (
              <AlertDot
                alerts={alerts}
                href={item.href}
                className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-ember"
              />
            )}
          </motion.span>
          <span className="relative font-medium">{item.short}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-30 md:hidden">
      <ul className="glass-panel mx-auto grid max-w-lg grid-cols-7 gap-0.5 rounded-[26px] p-1">
        {navItems.slice(0, half).map(tab)}

        <li className="flex items-center justify-center">
          <motion.button
            type="button"
            onClick={openMenu}
            aria-label="Add something"
            whileTap={{ scale: 0.9 }}
            className="relative -mt-7 flex h-13 w-13 items-center justify-center rounded-full bg-ember text-on-ember shadow-[0_12px_24px_-8px_var(--ember)] ring-4 ring-white/70 dark:ring-white/10"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </motion.button>
        </li>

        {navItems.slice(half).map(tab)}
      </ul>
    </nav>
  );
}
