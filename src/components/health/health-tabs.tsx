"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  { href: "/health/gym", label: "Gym", emoji: "🏋️" },
  { href: "/health/habits", label: "Habits", emoji: "✅" },
];

export default function HealthTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Health sections">
      <ul className="grid grid-cols-2 gap-1 rounded-2xl border border-paper/10 bg-paper/[0.03] p-1 sm:inline-grid sm:w-80">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? "text-on-ember" : "text-paper/60 hover:text-paper"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="health-tab"
                    className="absolute inset-0 rounded-xl bg-ember"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative">{tab.emoji}</span>
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
