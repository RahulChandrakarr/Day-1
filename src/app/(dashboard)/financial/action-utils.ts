import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error: string | null;
  // Bumps on every submit so the client can react (reset, toast)
  version: number;
  ok: boolean;
  values?: Record<string, string>;
};

export const uuid = /^[0-9a-f-]{36}$/i;

export async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new Error("Not signed in.");
  return supabase;
}

export function refresh() {
  revalidatePath("/financial", "layout");
  revalidatePath("/");
}

export function formFields(formData: FormData, keys: string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, String(formData.get(key) ?? "").trim()]),
  );
}

// Parses "12,500.50" style input; null when invalid.
export function parseAmount(raw: string, { allowZero = false } = {}) {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n >= 1e12)
    return null;
  return Math.round(n * 100) / 100;
}
