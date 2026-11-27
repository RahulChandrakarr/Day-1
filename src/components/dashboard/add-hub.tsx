"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Sheet from "@/components/ui/sheet";
import { NoteSheet, TodoSheet } from "./quick-add";

// One place to add anything, from anywhere in the app. The Add button (the
// centre of the phone's tab bar, the top of the desktop sidebar) opens a menu:
// Money, To-do, Note, Health. Each opens its form. There is exactly one "add
// entry" form in the app, rendered by the dashboard layout; buttons anywhere
// ask this hub to open it instead of carrying their own copy.

// Which tab the add-entry form should start on. null lets the form pick from
// the page you're on (Borrow on the Borrow page, and so on); "health" means
// today's workout if there is one, else the habit check-in.
export type EntryStart = "entry" | "health" | null;

type Hub = {
  entry: { open: boolean; start: EntryStart; session: number };
  openEntry: (start?: EntryStart) => void;
  closeEntry: () => void;
  openMenu: () => void;
};

const AddContext = createContext<Hub | null>(null);

export function useAddHub() {
  const hub = useContext(AddContext);
  if (!hub) throw new Error("useAddHub needs <AddHub> above it");
  return hub;
}

// ?add=… in the address (home-screen shortcuts, the notification button)
// opens the form as the page loads
const hasAddParam = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("add");

const CHOICES: { id: "money" | "todo" | "note" | "health"; emoji: string; title: string; hint: string }[] = [
  { id: "money", emoji: "💰", title: "Money", hint: "Spent, earned, borrowed, saved, EMI" },
  { id: "todo", emoji: "☑️", title: "To-do", hint: "For today's list" },
  { id: "note", emoji: "🗒️", title: "Note", hint: "Saved to Plan → Notes" },
  { id: "health", emoji: "💪", title: "Health", hint: "Today's workout or a habit check-in" },
];

export default function AddHub({
  children,
  entryForm,
}: {
  children: ReactNode;
  // The add-entry form with its data, loaded on the server
  entryForm: ReactNode;
}) {
  const [entry, setEntry] = useState<Hub["entry"]>(() => ({
    open: hasAddParam(),
    start: null,
    session: 0,
  }));
  const [sheet, setSheet] = useState<"menu" | "todo" | "note" | null>(null);

  const openEntry = useCallback((start: EntryStart = null) => {
    setSheet(null);
    setEntry((e) => ({ open: true, start, session: e.session + 1 }));
  }, []);
  const closeEntry = useCallback(() => setEntry((e) => ({ ...e, open: false })), []);
  const openMenu = useCallback(() => setSheet("menu"), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const hub = useMemo(
    () => ({ entry, openEntry, closeEntry, openMenu }),
    [entry, openEntry, closeEntry, openMenu],
  );

  function choose(id: (typeof CHOICES)[number]["id"]) {
    if (id === "money") openEntry("entry");
    else if (id === "health") openEntry("health");
    else setSheet(id);
  }

  return (
    <AddContext.Provider value={hub}>
      {children}
      {entryForm}

      <Sheet open={sheet === "menu"} onClose={closeSheet} title="Add">
        <ul className="grid grid-cols-2 gap-2">
          {CHOICES.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => choose(choice.id)}
                className="flex h-full min-h-28 w-full flex-col items-start gap-1 rounded-inset border border-paper/10 bg-inset p-4 text-left transition hover:bg-paper/5 active:scale-[0.98]"
              >
                <span className="text-2xl" aria-hidden>
                  {choice.emoji}
                </span>
                <span className="text-[17px] font-bold tracking-[-0.01em]">{choice.title}</span>
                <span className="text-xs text-paper/70">{choice.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <TodoSheet open={sheet === "todo"} onClose={closeSheet} />
      <NoteSheet open={sheet === "note"} onClose={closeSheet} />
    </AddContext.Provider>
  );
}

// "+ Add entry" at the top of the Money pages: opens the one form, on the tab
// that fits the page
export function AddEntryButton() {
  const { openEntry } = useAddHub();
  return (
    <button
      type="button"
      onClick={() => openEntry()}
      className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ember px-5 font-medium text-on-ember shadow-sm transition-colors hover:bg-ember-light active:scale-[0.98]"
    >
      <span className="text-xl leading-none">+</span>
      Add entry
    </button>
  );
}
