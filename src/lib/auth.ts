import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  created_at: string;
};

// Returns the signed-in user's profile, or sends them to /login.
// Cached per request so layouts and pages share one lookup.
export const requireProfile = cache(async function requireProfile() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, profile };
});

export async function requireAdmin() {
  const result = await requireProfile();
  if (result.profile.role !== "admin") redirect("/");
  return result;
}
