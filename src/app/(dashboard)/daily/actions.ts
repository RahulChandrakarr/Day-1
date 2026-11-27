"use server";

import { revalidatePath } from "next/cache";
import { isValidDate } from "@/lib/finance";
import type { Habit, JournalEntry } from "@/lib/journal";
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
    office_mood: scale(entry.office_mood),
    office_notes: text(entry.office_notes, 4000),
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
  options: {
    kind?: "build" | "quit";
    count_label?: string | null;
    daily_limit?: number | null;
  } = {},
): Promise<{ ok: true; habit: Habit } | { ok: false; error: string }> {
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!clean || clean.length > 40)
    return { ok: false, error: "Habit names are 1–40 characters." };
  const label = String(options.count_label ?? "").trim().slice(0, 20);
  const limit = Number(options.daily_limit);
  const supabase = await authedClient();
  const { data, error } = await supabase
    .from("journal_habits")
    .insert({
      name: clean,
      kind: options.kind === "quit" ? "quit" : "build",
      count_label: label || null,
      daily_limit:
        label && Number.isInteger(limit) && limit >= 0 && limit <= 1000
          ? limit
          : null,
    })
    .select("id, name, kind, count_label, daily_limit")
    .single();
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "You already have that habit." : error.message,
    };
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath("/health/habits");
  return { ok: true, habit: data };
}

// Change a habit's type or its daily counter
export async function updateHabit(
  id: string,
  patch: {
    kind?: "build" | "quit";
    count_label?: string | null;
    daily_limit?: number | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown habit." };
  const label =
    patch.count_label === undefined
      ? undefined
      : String(patch.count_label ?? "").trim().slice(0, 20) || null;
  const limit = Number(patch.daily_limit);
  const supabase = await authedClient();
  const { error } = await supabase
    .from("journal_habits")
    .update({
      ...(patch.kind ? { kind: patch.kind } : {}),
      ...(label === undefined ? {} : { count_label: label }),
      ...(patch.daily_limit === undefined
        ? {}
        : {
            daily_limit:
              label !== null && Number.isInteger(limit) && limit >= 0 && limit <= 1000
                ? limit
                : null,
          }),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath("/health/habits");
  return { ok: true };
}

export async function deleteHabit(id: string) {
  if (!uuid.test(id)) return;
  const supabase = await authedClient();
  await supabase.from("journal_habits").delete().eq("id", id);
  revalidatePath("/");
  revalidatePath("/daily");
  revalidatePath("/health/habits");
}

// Quick note from the add sheet: appended to today's journal notes.
export async function appendJournalNote(
  text: string,
  date: string,
  mood?: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = String(text ?? "").trim();
  if (!isValidDate(date)) return { ok: false, error: "Invalid date." };
  if (!note && mood === undefined) return { ok: false, error: "Write something first." };

  const supabase = await authedClient();
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("notes")
    .eq("entry_date", date)
    .maybeSingle<{ notes: string }>();

  const notes = [existing?.notes?.trim(), note].filter(Boolean).join("\n");
  const { error } = await supabase.from("journal_entries").upsert(
    {
      entry_date: date,
      notes: notes.slice(0, 20000),
      ...(mood === undefined ? {} : { mood }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entry_date" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/daily");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// To-dos: the same list as the journal's priorities for that day
// ---------------------------------------------------------------------------
type Todo = { text: string; done: boolean };

async function readTodos(
  supabase: Awaited<ReturnType<typeof authedClient>>,
  date: string,
) {
  const { data } = await supabase
    .from("journal_entries")
    .select("priorities")
    .eq("entry_date", date)
    .maybeSingle<{ priorities: Todo[] }>();
  return (data?.priorities ?? []).filter((p) => p?.text?.trim());
}

async function writeTodos(
  supabase: Awaited<ReturnType<typeof authedClient>>,
  date: string,
  todos: Todo[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("journal_entries").upsert(
    {
      entry_date: date,
      priorities: todos.slice(0, 50),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entry_date" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/daily");
  return { ok: true };
}

export async function addTodos(
  texts: string[],
  date: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidDate(date)) return { ok: false, error: "Invalid date." };
  const fresh = (Array.isArray(texts) ? texts : [])
    .map((t) => text(t, 200).trim())
    .filter(Boolean)
    .map((t) => ({ text: t, done: false }));
  if (fresh.length === 0) return { ok: false, error: "Write a to-do first." };
  const supabase = await authedClient();
  const todos = await readTodos(supabase, date);
  if (todos.length + fresh.length > 50)
    return { ok: false, error: "A day holds up to 50 to-dos." };
  return writeTodos(supabase, date, [...todos, ...fresh]);
}

// Matched by position and text, so a list changed elsewhere isn't mangled
export async function setTodoDone(
  date: string,
  index: number,
  todoText: string,
  done: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidDate(date)) return { ok: false, error: "Invalid date." };
  const supabase = await authedClient();
  const todos = await readTodos(supabase, date);
  const at =
    todos[index]?.text === todoText
      ? index
      : todos.findIndex((t) => t.text === todoText);
  if (at < 0) return { ok: false, error: "That to-do changed. Refresh and try again." };
  todos[at] = { ...todos[at], done: Boolean(done) };
  return writeTodos(supabase, date, todos);
}

// Replace the whole to-do list for a day (used by the assistant)
export async function replaceTodos(
  todos: { text: string; done?: boolean }[],
  date: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidDate(date)) return { ok: false, error: "Invalid date." };
  const list = (Array.isArray(todos) ? todos : [])
    .map((t) => ({ text: text(t?.text, 200).trim(), done: Boolean(t?.done) }))
    .filter((t) => t.text);
  if (list.length > 50) return { ok: false, error: "A day holds up to 50 to-dos." };
  const supabase = await authedClient();
  return writeTodos(supabase, date, list);
}
