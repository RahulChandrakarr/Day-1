"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// How long a tap may go unanswered before the line shows. A page with a
// placeholder ready answers at once, and never sees the line at all.
const PATIENCE_MS = 120;
const GIVE_UP_MS = 12000;

// A thin warm line flowing across the top of the window while a page is on
// its way. Most pages answer a tap at once with their placeholder; this is
// for the ones that can't: stepping to another day or month keeps the old
// page on screen until the new one is ready, and without the line nothing
// would say the tap was heard.
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // The address a link was tapped on. The line shows only while we are still
  // there, so it goes by itself the moment the new page takes over.
  const [waitingOn, setWaitingOn] = useState<string | null>(null);

  useEffect(() => {
    let timer = 0;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      // Other sites and file downloads (the PDF reports) never become a page here
      if (to.origin !== window.location.origin || to.pathname.startsWith("/api/")) return;
      const from = `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;
      if (`${to.pathname}?${to.searchParams}` === from) return;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setWaitingOn(from);
        timer = window.setTimeout(() => setWaitingOn(null), GIVE_UP_MS);
      }, PATIENCE_MS);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      window.clearTimeout(timer);
    };
  }, []);

  return <div aria-hidden className={`nav-progress ${waitingOn === here ? "is-busy" : ""}`} />;
}
