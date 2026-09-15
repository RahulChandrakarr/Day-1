import "server-only";
import type { Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Auth for API routes: returns null instead of redirecting.
export async function getApiSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();
  if (!profile) return null;

  return { supabase, profile };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function firstName(profile: Profile) {
  return (
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there"
  );
}
