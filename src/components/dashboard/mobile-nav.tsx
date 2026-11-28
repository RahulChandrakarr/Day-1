"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Profile } from "@/lib/auth";
import { useAddHub } from "./add-hub";
import Avatar from "./avatar";
import MeMenu from "./me-menu";
import { isActive, navItems } from "./nav";
import { AlertDot, useTapped } from "./nav-state";

// Phones: no top bar, so each page starts at the top of the screen. A floating
// bar at the bottom holds five slots: Home, Daily, the raised Add button (money,
// to-do, note, health), Money, and Me. Me is your photo; it opens a menu with
// the sections that don't get a tab (Health, Plan, Ask) and all of Settings.

const TABS = ["/", "/daily", "/financial/daily"];
const tabs = navItems.filter((item) => TABS.includes(item.href));
// In the order the Me menu shows them
const menuSections = ["/health/gym", "/plan", "/assistant", "/jobs", "/watch"].flatMap((href) =>
  navItems.filter((item) => item.href === href),
);
// Pages that light up the Me tab
const meHrefs = [...menuSections.map((item) => item.href), "/settings", "/admin"];

export default function MobileNav({
  profile,
  avatarUrl,
  alerts,
}: {
  profile: Profile;
  avatarUrl: string | null;
  // Tabs that want attention; it arrives after the bar itself (see AlertDot)
  alerts: Promise<string[]>;
}) {
  const pathname = usePathname();
  const [tapped, tap] = useTapped(pathname);
  const { openMenu } = useAddHub();
  // The Me menu belongs to the page it was opened on, so it shuts by itself
  // once another page arrives
  const [menuOn, setMenuOn] = useState<string | null>(null);
  const menuOpen = menuOn === pathname;
  const name = profile.full_name || profile.email.split("@")[0];
  // Where we are, or where we're going while that page is on its way
  const here = tapped ?? pathname;
  const meActive = meHrefs.some((href) => isActive(here, href));

  const dot = (href: string | string[]) => (
    <AlertDot
      alerts={alerts}
      href={href}
      className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-ember"
    />
  );

  const tab = (item: (typeof tabs)[number]) => {
    const active = isActive(here, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onNavigate={() => tap(item.href)}
          aria-current={active ? "page" : undefined}
          className={tabClass(active)}
        >
          <TabFace active={active} icon={item.icon} label={item.short} dot={dot(item.href)} />
        </Link>
      </li>
    );
  };

  return (
    <nav className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-30 md:hidden">
      <ul className="glass-panel mx-auto grid max-w-lg grid-cols-5 gap-0.5 rounded-[26px] p-1">
        {tabs.slice(0, 2).map(tab)}

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

        {tabs.slice(2).map(tab)}

        <li>
          <button
            type="button"
            onClick={() => setMenuOn(pathname)}
            aria-label="Me: Health, Plan, Ask, Jobs, Watch and Settings"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={tabClass(meActive)}
          >
            <TabFace
              active={meActive}
              icon={
                <span
                  className={`flex h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-full bg-paper/15 text-[11px] font-semibold ring-[1.5px] ${
                    meActive ? "ring-ember" : "ring-paper/40"
                  }`}
                >
                  <Avatar url={avatarUrl} name={name} />
                </span>
              }
              label="Me"
              dot={dot(menuSections.map((item) => item.href))}
            />
          </button>
        </li>
      </ul>

      <MeMenu
        open={menuOpen}
        onClose={() => setMenuOn(null)}
        title={name}
        sections={menuSections}
        isAdmin={profile.role === "admin"}
        pathname={pathname}
        alerts={alerts}
        onNavigate={(href) => {
          tap(href);
          setMenuOn(null);
        }}
      />
    </nav>
  );
}

const tabClass = (active: boolean) =>
  `relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10.5px] transition-colors ${
    active ? "font-semibold text-ember" : "text-paper/70"
  }`;

function TabFace({
  active,
  icon,
  label,
  dot,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  dot: ReactNode;
}) {
  return (
    <>
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
        {icon}
        {!active && dot}
      </motion.span>
      <span className="relative font-medium">{label}</span>
    </>
  );
}
