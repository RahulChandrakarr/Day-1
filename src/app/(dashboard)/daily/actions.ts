"use server";

import { revalidatePath } from "next/cache";
import { isValidDate } from "@/lib/finance";
import type { JournalEntry } from "@/lib/journal";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f-]{36}$/i;

async function authedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new Error("Not signed in.");
  return supabase;
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";

const scale = (value: unknown) =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5
    ? (value as number)
    : null;

// Auto-save target: writes the whole page for one day.
export async function saveJournal(
  entry: JournalEntry,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidDate(entry?.entry_date))
    return { ok: false, error: "Invalid date." };

  const row = {
    entry_date: entry.entry_date,
    mood: scale(entry.mood),
    energy: scale(entry.energy),
    gratitude: (Array.isArray(entry.gratitude) ? entry.gratitude : [])
      .slice(0, 3)
      .map((g) => text(g, 300)),
    // Empty rows aren't stored
    priorities: (Array.isArray(entry.priorities) ? entry.priorities : [])
      .map((p) => ({ text: text(p?.text, 200), done: Boolean(p?.done) }))
      .filter((p) => p.text.trim())
      .slice(0, 50),
    habits_done: (Array.isArray(entry.habits_done) ? entry.habits_done : [])
      .filter((id) => typeof id === "string" && uuid.test(id))
      .slice(0, 50),
    notes: text(entry.notes, 20000),
    wins: text(entry.wins, 2000),
    lessons: text(entry.lessons, 2000),
    tomorrow: text(entry.tomorrow, 2000),
    updated_at: new Date().toISOString(),
  };

  const supabase = await authedClient();
  const { error } = await supabase
    .from("journal_entries")
    .upsert(row, { onConflict: "user_id,entry_date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addHabit(
  name: string,
): Promise<{ ok: true; habit: { id: string; name: string } } | { ok: false; error: string }> {
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 40)
    return { ok: false, error: "Habit names are 1–40 characters." };
  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("journal_habits")
    .insert({ name: clean })
    .select("id, name")
    .single();
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "You already have that habit." : error.message,
    };
  revalidatePath("/", "layout");
  return { ok: true, habit: data };
}

export async function deleteHabit(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("journal_habits").delete().eq("id", id);
  revalidatePath("/", "layout");
}
