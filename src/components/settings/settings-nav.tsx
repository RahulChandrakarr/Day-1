"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/settings/notifications", label: "Notifications", emoji: "🔔", hint: "Reminders & alerts" },
  { href: "/settings/profile", label: "Profile", emoji: "👤", hint: "You, photo, body" },
  { href: "/settings/documents", label: "Documents", emoji: "📁", hint: "Your saved files" },
  { href: "/settings/reports", label: "Reports", emoji: "📄", hint: "Download PDFs" },
];

// Sidebar on wide screens, a scrolling tab row on phones.
export default function SettingsNav() {
  const pathname = usePathname();
  const active = sections.find((s) => pathname.startsWith(s.href))?.href;

  return (
    <nav aria-label="Settings sections" className="md:sticky md:top-6 md:w-56 md:shrink-0 md:self-start">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:rounded-2xl md:border md:border-paper/10 md:bg-surface md:p-2">
        {sections.map((s) => {
          const isActive = s.href === active;
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors md:h-auto md:rounded-xl md:px-3 md:py-2.5 ${
                  isActive
                    ? "bg-ember text-on-ember"
                    : "border border-paper/10 bg-surface text-paper/65 hover:text-paper md:border-0 md:bg-transparent md:hover:bg-paper/5"
                }`}
              >
                <span aria-hidden>{s.emoji}</span>
                <span className="md:flex md:flex-col">
                  {s.label}
                  <span
                    className={`hidden text-xs font-normal md:block ${
                      isActive ? "text-on-ember/70" : "text-paper/45"
                    }`}
                  >
                    {s.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
