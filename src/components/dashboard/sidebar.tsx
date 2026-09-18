"use client";

import Link from "next/link";
import Avatar from "./avatar";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme";
import Logo from "@/components/ui/logo";
import type { Profile } from "@/lib/auth";
import { isActive, logoutIcon, navItems, settingsIcon, usersIcon } from "./nav";

// Desktop and tablet: icon rail at md, full sidebar at lg.
export default function Sidebar({
  profile,
  avatarUrl = null,
  alerts = [],
}: {
  profile: Profile;
  avatarUrl?: string | null;
  alerts?: string[];
}) {
  const pathname = usePathname();
  const name = profile.full_name || profile.email.split("@")[0];

  const links = [
    ...navItems,
    { href: "/settings", label: "Settings", icon: settingsIcon },
    ...(profile.role === "admin"
      ? [{ href: "/admin/users", label: "Users", icon: usersIcon }]
      : []),
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-paper/10 bg-ink px-3 py-6 md:flex lg:w-64 lg:px-4">
      <Link
        href="/"
        className="flex items-center gap-3 px-2 lg:px-3"
        aria-label="Day One home"
      >
        <Logo className="h-10 w-auto" priority />
      </Link>

      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {links.map((item, i) => {
          const active = isActive(pathname, item.href);
          const isAdminLink = item.href.startsWith("/admin");
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              className={
                isAdminLink ? "mt-6 border-t border-paper/10 pt-6" : ""
              }
            >
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm transition-colors lg:justify-start ${
                  active ? "text-on-ember" : "text-paper/60 hover:text-paper"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-ember"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {!active && (
                  <span className="absolute inset-0 rounded-xl bg-paper/0 transition-colors group-hover:bg-paper/5" />
                )}
                <span className="relative">
                  {item.icon}
                  {alerts.includes(item.href) && !active && (
                    <span
                      aria-label="Reminder"
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-ember"
                    />
                  )}
                </span>
                <span className="relative hidden font-medium lg:block">
                  {item.label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-paper/10 pt-4">
        <div className="flex items-center justify-center gap-3 px-1 lg:justify-start lg:px-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 text-sm font-medium">
            <Avatar url={avatarUrl} name={name} />
          </span>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs capitalize text-paper/40">
              {profile.role}
            </p>
          </div>
        </div>
        <ThemeToggle
          className="h-10 w-full justify-center rounded-xl px-3 text-sm hover:bg-paper/5 lg:justify-start"
          labelClassName="hidden lg:block"
        />
        <form action={logout}>
          <button
            title="Sign out"
            className="flex h-10 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm text-paper/50 transition hover:bg-paper/5 hover:text-paper lg:justify-start"
          >
            {logoutIcon}
            <span className="hidden lg:block">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
