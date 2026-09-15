// Daily journal types (safe for server and client).

export type Priority = { text: string; done: boolean };

export type Habit = { id: string; name: string };

export type JournalEntry = {
  entry_date: string; // YYYY-MM-DD
  mood: number | null; // 1-5
  energy: number | null; // 1-5
  gratitude: string[]; // up to 3
  priorities: Priority[]; // any number, in order
  habits_done: string[];
  notes: string;
  wins: string;
  lessons: string;
  tomorrow: string;
};

export type JournalDay = Pick<JournalEntry, "entry_date" | "mood">;

export const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "🙁", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export const ENERGY = ["Drained", "Tired", "Steady", "Energetic", "Full"];

export function emptyEntry(date: string): JournalEntry {
  return {
    entry_date: date,
    mood: null,
    energy: null,
    gratitude: ["", "", ""],
    priorities: [
      { text: "", done: false },
      { text: "", done: false },
      { text: "", done: false },
    ],
    habits_done: [],
    notes: "",
    wins: "",
    lessons: "",
    tomorrow: "",
  };
}

// Fills missing slots so the editor always shows 3 gratitude lines and some priority rows.
export function normalizeEntry(
  date: string,
  row: Partial<JournalEntry> | null,
): JournalEntry {
  const base = emptyEntry(date);
  if (!row) return base;
  return {
    ...base,
    ...row,
    entry_date: date,
    gratitude: [0, 1, 2].map((i) => row.gratitude?.[i] ?? ""),
    // Saved priorities, or the 3 empty starter rows on a fresh page
    priorities: row.priorities?.length
      ? row.priorities.map((p) => ({
          text: p?.text ?? "",
          done: Boolean(p?.done),
        }))
      : base.priorities,
    habits_done: row.habits_done ?? [],
    notes: row.notes ?? "",
    wins: row.wins ?? "",
    lessons: row.lessons ?? "",
    tomorrow: row.tomorrow ?? "",
  };
}
