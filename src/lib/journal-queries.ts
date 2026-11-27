import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeEntry,
  type Habit,
  type JournalDay,
  type JournalEntry,
} from "@/lib/journal";

const ENTRY_COLUMNS =
  "entry_date, mood, energy, office_mood, office_notes, gratitude, priorities, habits_done, notes, wins, lessons, tomorrow";

export async function getJournalEntry(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(ENTRY_COLUMNS)
    .eq("entry_date", date)
    .maybeSingle<JournalEntry>();
  if (error) throw new Error(error.message);
  return { entry: normalizeEntry(date, data), exists: Boolean(data) };
}

// Days with a journal page in a date range (for the week strip).
export async function getJournalDays(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("entry_date, mood")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .returns<JournalDay[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getHabits() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_habits")
    .select("id, name, kind, count_label, daily_limit")
    .order("created_at", { ascending: true })
    .returns<Habit[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Full journal pages in a date range, oldest first (for the PDF report).
export async function getJournalRange(from: string, to: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select(ENTRY_COLUMNS)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date")
    .returns<JournalEntry[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeEntry(row.entry_date, row));
}
