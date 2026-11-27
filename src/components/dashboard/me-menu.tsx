"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { settingsSections } from "@/components/settings/settings-nav";
import Sheet from "@/components/ui/sheet";
import { isActive, logoutIcon, usersIcon, type NavItem } from "./nav";
import { AlertDot } from "./nav-state";

// Phones: what opens from Me, the photo at the end of the tab bar. The sections
// without a tab of their own sit on top as tiles (Health, Plan, Ask); under
// them is the same list as the Settings sidebar, then Users for admins, then
// Sign out.
export default function MeMenu({
  open,
  onClose,
  title,
  sections,
  isAdmin,
  pathname,
  alerts,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: NavItem[];
  isAdmin: boolean;
  pathname: string;
  alerts: Promise<string[]>;
  // Called as a link in the menu is tapped, before its page arrives
  onNavigate: (href: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="grid grid-cols-3 gap-2">
        {sections.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onNavigate={() => onNavigate(item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-22 flex-col justify-between gap-3 rounded-inset border p-3.5 transition active:scale-[0.98] ${
                  active
                    ? "border-transparent bg-ember text-on-ember"
                    : "border-paper/10 bg-inset hover:bg-paper/5"
                }`}
              >
                <span className="relative self-start">
                  {item.icon}
                  {!active && (
                    <AlertDot
                      alerts={alerts}
                      href={item.href}
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-ember"
                    />
                  )}
                </span>
                <span className="text-[15px] font-bold tracking-[-0.01em]">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <h3 className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-paper/60">
        Settings
      </h3>
      <ul className="divide-y divide-paper/10 overflow-hidden rounded-inset border border-paper/10 bg-inset">
        {settingsSections.map((s) => (
          <li key={s.href}>
            <Row
              href={s.href}
              icon={s.icon}
              label={s.label}
              hint={s.hint}
              active={pathname === s.href || pathname.startsWith(`${s.href}/`)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>

      <ul className="mt-3 divide-y divide-paper/10 overflow-hidden rounded-inset border border-paper/10 bg-inset">
        {isAdmin && (
          <li>
            <Row
              href="/admin/users"
              icon={usersIcon}
              label="Users"
              hint="Who can sign in"
              active={pathname.startsWith("/admin")}
              onNavigate={onNavigate}
            />
          </li>
        )}
        <li>
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-13 w-full items-center gap-3 px-3.5 text-left text-sm font-medium text-paper/75 transition hover:bg-paper/5 hover:text-paper"
            >
              <span className="shrink-0">{logoutIcon}</span>
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </Sheet>
  );
}

function Row({
  href,
  icon,
  label,
  hint,
  active,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  hint: string;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      onNavigate={() => onNavigate(href)}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-13 items-center gap-3 px-3.5 py-2 transition-colors hover:bg-paper/5 ${
        active ? "text-ember" : ""
      }`}
    >
      <span className={`shrink-0 ${active ? "" : "text-paper/70"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
        <span className="block truncate text-xs text-paper/60">{hint}</span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-paper/40"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
