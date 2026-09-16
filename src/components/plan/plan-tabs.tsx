"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/plan", label: "Year", exact: true },
  { href: "/plan/month", label: "Month" },
  { href: "/plan/week", label: "Week" },
  { href: "/plan/today", label: "Today" },
  { href: "/plan/notes", label: "Notes" },
];

export default function PlanTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Plan views">
      <ul className="grid grid-cols-5 gap-1 rounded-2xl border border-paper/10 bg-surface p-1 sm:inline-grid sm:w-[30rem]">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-ember text-on-ember shadow-sm"
                    : "text-paper/55 hover:text-paper"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
