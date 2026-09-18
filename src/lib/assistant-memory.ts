import "server-only";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const DEFAULT_ASSISTANT_NAME = "Romi";
// What goes into every prompt; plenty for personal facts, still cheap
export const MEMORY_LIMIT = 60;

export type Memory = { id: string; label: string; value: string; updated_at: string };

type Result = { ok: true } | { ok: false; error: string };

export async function getAssistantName(client?: Supabase) {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("assistant_settings")
    .select("name")
    .maybeSingle<{ name: string }>();
  return data?.name?.trim() || DEFAULT_ASSISTANT_NAME;
}

export async function getMemories(client?: Supabase, limit = 200): Promise<Memory[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("assistant_memories")
    .select("id, label, value, updated_at")
    .order("label")
    .limit(limit)
    .returns<Memory[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// "date of birth" → "Date of birth"
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
const tidyLabel = (label: string) => {
  const t = tidy(label);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const exactly = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

// Saves a fact; the same label (any case) replaces the old value
export async function saveMemory(
  supabase: Supabase,
  input: { id?: string | null; label: string; value: string },
): Promise<Result & { label?: string }> {
  const label = tidyLabel(String(input.label ?? ""));
  const value = tidy(String(input.value ?? ""));
  if (!label || label.length > 60) return { ok: false, error: "Give the fact a short name (up to 60 characters)." };
  if (!value || value.length > 300) return { ok: false, error: "Keep the fact under 300 characters." };

  let id = input.id ?? null;
  if (!id) {
    const { data: existing } = await supabase
      .from("assistant_memories")
      .select("id")
      .ilike("label", exactly(label))
      .maybeSingle<{ id: string }>();
    id = existing?.id ?? null;
  }
  const { error } = id
    ? await supabase
        .from("assistant_memories")
        .update({ label, value, updated_at: new Date().toISOString() })
        .eq("id", id)
    : await supabase.from("assistant_memories").insert({ label, value });
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? `You already have a fact called "${label}".` : error.message,
    };
  return { ok: true, label };
}

// By id (Settings) or by label (the assistant)
export async function forgetMemory(
  supabase: Supabase,
  by: { id: string } | { label: string },
): Promise<Result & { removed?: number }> {
  const query = supabase.from("assistant_memories").delete();
  const { data, error } = await ("id" in by
    ? query.eq("id", by.id)
    : query.ilike("label", exactly(tidy(by.label)))
  ).select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, removed: data?.length ?? 0 };
}

export async function renameAssistant(supabase: Supabase, name: string): Promise<Result> {
  const clean = tidy(String(name ?? ""));
  if (!clean || clean.length > 20) return { ok: false, error: "Use a name of 1–20 characters." };
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("assistant_settings")
    .upsert({ user_id: uid, name: clean, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: error.message } : { ok: true };
}
