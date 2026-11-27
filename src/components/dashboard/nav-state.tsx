"use client";

import { Suspense, use, useEffect, useState } from "react";

// What the sidebar and the phone's tab bar share.

// The tab lights up the moment it is tapped, not when its page arrives.
// Returns the tapped tab while that page is still on its way (else null), and
// the function a tab calls when it is tapped.
export function useTapped(pathname: string) {
  const [tapped, setTapped] = useState<string | null>(null);

  // Once the address changes, the page itself says where we are
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setTapped(null);
  }

  // A tap that never became a page (no network): let go of it
  useEffect(() => {
    if (!tapped) return;
    const timer = window.setTimeout(() => setTapped(null), 8000);
    return () => window.clearTimeout(timer);
  }, [tapped]);

  return [tapped, setTapped] as const;
}

// The small dot on a tab that wants attention. A tab that stands for several
// sections (the phone's Me tab) passes all their addresses. The list of those tabs comes
// from the server after the frame of the page has already been sent, so the
// frame never waits for it; until it lands there is simply no dot.
export function AlertDot({
  alerts,
  href,
  className,
}: {
  alerts: Promise<string[]>;
  href: string | string[];
  className: string;
}) {
  return (
    <Suspense fallback={null}>
      <Dot alerts={alerts} href={href} className={className} />
    </Suspense>
  );
}

function Dot({
  alerts,
  href,
  className,
}: {
  alerts: Promise<string[]>;
  href: string | string[];
  className: string;
}) {
  const wanted = use(alerts);
  const hrefs = typeof href === "string" ? [href] : href;
  return hrefs.some((h) => wanted.includes(h)) ? (
    <span aria-label="Reminder" className={className} />
  ) : null;
}
