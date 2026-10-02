"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/health/gym", label: "Gym", emoji: "🏋️" },
  { href: "/health/habits", label: "Habits", emoji: "✅" },
  { href: "/health/body", label: "Body", emoji: "📊" },
  { href: "/health/report", label: "Report", emoji: "📈" },
];

export default function HealthTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Health sections">
      <ul className="grid grid-cols-2 gap-1 rounded-2xl sm:grid-cols-4 card p-1 sm:inline-grid sm:w-[34rem]">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-ember text-on-ember shadow-sm"
                    : "text-paper/55 hover:text-paper"
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
