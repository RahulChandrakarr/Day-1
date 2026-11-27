"use client";

import Link from "next/link";
import Avatar from "./avatar";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { logout } from "@/app/login/actions";
import Logo from "@/components/ui/logo";
import type { Profile } from "@/lib/auth";
import { useAddHub } from "./add-hub";
import { isActive, logoutIcon, navItems, settingsIcon, usersIcon } from "./nav";
import { AlertDot, useTapped } from "./nav-state";

// Desktop and tablet: icon rail at md, full sidebar at lg.
export default function Sidebar({
  profile,
  avatarUrl = null,
  alerts,
}: {
  profile: Profile;
  avatarUrl?: string | null;
  // Tabs that want attention; it arrives after the sidebar itself (see AlertDot)
  alerts: Promise<string[]>;
}) {
  const pathname = usePathname();
  const [tapped, tap] = useTapped(pathname);
  const { openMenu } = useAddHub();
  const name = profile.full_name || profile.email.split("@")[0];

  const links = [
    ...navItems,
    { href: "/settings", label: "Settings", icon: settingsIcon },
    ...(profile.role === "admin"
      ? [{ href: "/admin/users", label: "Users", icon: usersIcon }]
      : []),
  ];

  return (
    // A floating glass panel, inset from the window edge
    <aside className="sticky top-0 hidden h-dvh w-[5.5rem] shrink-0 p-3 md:flex lg:w-[17rem]">
      <div className="glass-panel flex min-h-0 flex-1 flex-col rounded-[28px] px-2.5 py-6 lg:px-3.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-2 lg:px-3"
          aria-label="Day One home"
        >
          <Logo className="h-10 w-auto" priority />
        </Link>

        {/* Opens the Add menu: money, to-do, note, health */}
        <button
          type="button"
          onClick={openMenu}
          title="Add something"
          className="mt-8 flex h-11 items-center justify-center gap-2 rounded-2xl bg-ember px-3 text-sm font-semibold text-on-ember shadow-[0_10px_24px_-10px_var(--ember)] transition-colors hover:bg-ember-light lg:justify-start lg:px-4"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="hidden lg:block">Add</span>
        </button>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {links.map((item, i) => {
            const active = tapped ? item.href === tapped : isActive(pathname, item.href);
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
                  onNavigate={() => tap(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-11 items-center justify-center gap-3 rounded-2xl px-3 text-sm transition-colors lg:justify-start ${
                    active ? "font-semibold text-ember" : "text-paper/75 hover:text-paper"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-2xl bg-surface/90 shadow-[0_8px_20px_-10px_rgb(120_90_70/0.4)] dark:bg-white/[0.12] dark:shadow-none"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {!active && (
                    <span className="absolute inset-0 rounded-2xl bg-paper/0 transition-colors group-hover:bg-paper/5" />
                  )}
                  <span className="relative">
                    {item.icon}
                    {!active && (
                      <AlertDot
                        alerts={alerts}
                        href={item.href}
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
          {/* Light/dark lives in Settings -> Appearance now; this opens Profile */}
          <Link
            href="/settings/profile"
            title="Your profile"
            className="flex items-center justify-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-paper/5 lg:justify-start lg:px-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 text-sm font-medium">
              <Avatar url={avatarUrl} name={name} />
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs capitalize text-paper/55">
                {profile.role}
              </span>
            </span>
          </Link>
          <form action={logout}>
            <button
              title="Sign out"
              className="flex h-10 w-full items-center justify-center gap-3 rounded-xl px-3 text-sm text-paper/65 transition hover:bg-paper/5 hover:text-paper lg:justify-start"
            >
              {logoutIcon}
              <span className="hidden lg:block">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
