"use server";

import { revalidatePath } from "next/cache";
import type { ReminderKind } from "@/lib/reminders";
import { clearSpendPin, refreshSpendPin } from "@/lib/push/today";
import { createClient } from "@/lib/supabase/server";
import { forgetMemory, renameAssistant, saveMemory } from "@/lib/assistant-memory";

const KINDS = ["briefing", "journal", "habits", "gym", "money", "spend_pin", "plan"];

export async function saveReminder(input: {
  kind: ReminderKind;
  enabled: boolean;
  hour: number;
  minute: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!KINDS.includes(input?.kind))
    return { ok: false, error: "Unknown reminder." };
  const hour = Number(input.hour);
  const minute = Number(input.minute);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    return { ok: false, error: "Pick a valid time." };
  if (!Number.isInteger(minute) || minute < 0 || minute > 59)
    return { ok: false, error: "Pick a valid time." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("reminder_settings").upsert(
    {
      user_id: claims.claims.sub,
      kind: input.kind,
      enabled: Boolean(input.enabled),
      hour,
      minute,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/notifications");
  // Show or clear the pinned card right away
  if (input.kind === "spend_pin") {
    if (input.enabled) await refreshSpendPin();
    else await clearSpendPin();
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
type Result = { ok: true } | { ok: false; error: string };

export async function updateProfile(input: {
  fullName: string;
  avatarPath: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { ok: false, error: "Not signed in." };
  const avatarPath = input.avatarPath || null;
  if (avatarPath && !avatarPath.startsWith(`${uid}/`))
    return { ok: false, error: "Invalid photo." };

  // Remove the old photo when it's replaced or removed
  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", uid)
    .single<{ avatar_path: string | null }>();

  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: String(input.fullName ?? "").slice(0, 80),
    p_avatar_path: avatarPath,
  });
  if (error) return { ok: false, error: error.message };

  if (current?.avatar_path && current.avatar_path !== avatarPath)
    await supabase.storage.from("avatars").remove([current.avatar_path]);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(password: string): Promise<Result> {
  if (typeof password !== "string" || password.length < 8)
    return { ok: false, error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Documents (the file is uploaded from the browser straight to Storage)
// ---------------------------------------------------------------------------
const cleanText = (value: unknown, max: number) =>
  String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export async function addDocument(input: {
  name: string;
  folder: string;
  path: string;
  mime: string;
  size: number;
}): Promise<Result> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { ok: false, error: "Not signed in." };
  if (typeof input.path !== "string" || !input.path.startsWith(`${uid}/`))
    return { ok: false, error: "Invalid file." };
  const name = cleanText(input.name, 120);
  if (!name) return { ok: false, error: "Give the file a name." };
  const { error } = await supabase.from("documents").insert({
    name,
    folder: cleanText(input.folder, 40) || "Other",
    path: input.path,
    mime: cleanText(input.mime, 100),
    size: Math.max(0, Math.round(Number(input.size) || 0)),
  });
  if (error) {
    await supabase.storage.from("documents").remove([input.path]);
    return { ok: false, error: error.message };
  }
  revalidatePath("/settings/documents");
  return { ok: true };
}

export async function updateDocument(
  id: string,
  patch: { name?: string; folder?: string },
): Promise<Result> {
  const row: Record<string, string> = {};
  if (patch.name !== undefined) {
    const name = cleanText(patch.name, 120);
    if (!name) return { ok: false, error: "Give the file a name." };
    row.name = name;
  }
  if (patch.folder !== undefined) row.folder = cleanText(patch.folder, 40) || "Other";
  const supabase = await createClient();
  const { error } = await supabase.from("documents").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/documents");
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("path")
    .eq("id", id)
    .maybeSingle<{ path: string }>();
  if (!data) return { ok: false, error: "File not found." };
  const { error: storageError } = await supabase.storage.from("documents").remove([data.path]);
  if (storageError) return { ok: false, error: storageError.message };
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/documents");
  return { ok: true };
}

// A one-minute link to open or download a file
export async function documentLink(
  id: string,
  download: boolean,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("path, name, mime")
    .eq("id", id)
    .maybeSingle<{ path: string; name: string; mime: string }>();
  if (!data) return { ok: false, error: "File not found." };
  const ext = data.path.split(".").pop();
  const filename = data.name.toLowerCase().endsWith(`.${ext}`) ? data.name : `${data.name}.${ext}`;
  const { data: signed, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(data.path, 60, download ? { download: filename } : undefined);
  if (error || !signed) return { ok: false, error: error?.message ?? "Couldn't open the file." };
  return { ok: true, url: signed.signedUrl };
}

// ---------------------------------------------------------------------------
// Assistant: her name and what she remembers
// ---------------------------------------------------------------------------
export async function renameAssistantAction(name: string): Promise<Result> {
  const result = await renameAssistant(await createClient(), name);
  // The layout passes the name to the floating button (its wake word)
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveMemoryAction(input: {
  id?: string | null;
  label: string;
  value: string;
}): Promise<Result> {
  if (input.id && !/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, error: "Invalid fact." };
  const result = await saveMemory(await createClient(), input);
  if (result.ok) revalidatePath("/settings/assistant");
  return result.ok ? { ok: true } : result;
}

export async function deleteMemoryAction(id: string): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid fact." };
  const result = await forgetMemory(await createClient(), { id });
  if (result.ok) revalidatePath("/settings/assistant");
  return result.ok ? { ok: true } : result;
}
