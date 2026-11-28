"use client";

import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/ui/kit";
import { isActive, navItems } from "./nav";
import PageShell from "./page-shell";

// The placeholder shown the instant a tab is tapped, before anything has come
// back from the server. It is the same for every section, so it reads the
// address to put the right title on top: tapping Money shows "Financial" at
// once, and the real page then arrives under a heading that never changed.

// Sections that aren't tabs
const OTHER_TITLES: Record<string, string> = {
  "/settings": "Settings",
  "/admin": "Users",
  "/jobs": "Jobs",
  "/watch": "Watch",
};

// Sections with a line of text under the title, and whether phones show it.
// It only reserves the line's space, so nothing shifts when the page arrives.
const DESCRIBED: Record<string, { onPhones: boolean }> = {
  "/daily": { onPhones: true },
  "/financial": { onPhones: false },
  "/health": { onPhones: false },
  "/plan": { onPhones: true },
  "/jobs": { onPhones: true },
  "/watch": { onPhones: true },
  "/admin": { onPhones: true },
};

export default function RouteSkeleton() {
  const pathname = usePathname();
  const section = `/${pathname.split("/")[1] ?? ""}`;
  const title =
    navItems.find((item) => isActive(pathname, item.href))?.label ??
    OTHER_TITLES[section] ??
    // Keeps the heading's height when the section has no name here
    " ";
  const described = DESCRIBED[section];

  return (
    <PageShell
      title={title}
      description={
        described && (
          <span className="inline-block h-3 w-56 max-w-full rounded-full bg-paper/10 align-middle" />
        )
      }
      hideMobileDescription={!described?.onPhones}
    >
      {/* Home lays its cards out in columns; the other sections stack theirs */}
      {pathname === "/" ? <PageSkeleton rows={6} layout="triple" /> : <PageSkeleton rows={3} />}
    </PageShell>
  );
}
