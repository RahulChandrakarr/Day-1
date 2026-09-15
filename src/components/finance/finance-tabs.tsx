"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  { href: "/financial/daily", label: "Daily" },
  { href: "/financial/monthly", label: "Monthly" },
  { href: "/financial/yearly", label: "Yearly" },
  { href: "/financial/borrow", label: "Borrow" },
  { href: "/financial/savings", label: "Savings" },
  { href: "/financial/tracking", label: "Tracking" },
];

export default function FinanceTabs() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-2xl border border-paper/10 bg-paper/[0.03] p-1">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-10 items-center rounded-xl px-4 text-sm font-medium transition-colors sm:px-5 ${
                  active ? "text-on-ember" : "text-paper/60 hover:text-paper"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="finance-tab"
                    className="absolute inset-0 rounded-xl bg-ember"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
