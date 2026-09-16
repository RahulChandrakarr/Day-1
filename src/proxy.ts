import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals, static assets, the service worker
    // and the reminder job (which runs without a signed-in user)
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
