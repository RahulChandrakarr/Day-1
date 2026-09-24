"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteNote,
  saveNote,
  setNotePinned,
} from "@/app/(dashboard)/plan/actions";
import VoiceInput from "@/components/journal/voice-input";
import { Empty, inputClass, primaryButtonClass } from "@/components/ui/kit";
import Sheet from "@/components/ui/sheet";
import type { Note } from "@/lib/plans";

const updated = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

type Draft = { id?: string; title: string; body: string; pinned: boolean };

export default function NotesBoard({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [notes, query]);

  function open(note?: Note) {
    setError(null);
    setDraft(
      note
        ? { id: note.id, title: note.title, body: note.body, pinned: note.pinned }
        : { title: "", body: "", pinned: false },
    );
  }

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await saveNote(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function remove() {
    if (!draft?.id || !confirm("Delete this note?")) return;
    startTransition(async () => {
      const result = await deleteNote(draft.id!);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function togglePin(note: Note) {
    startTransition(async () => {
      await setNotePinned(note.id, !note.pinned);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => open()} className={primaryButtonClass}>
        ＋ New note
      </button>

      {notes.length > 3 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${notes.length} notes`}
          className={inputClass}
        />
      )}

      {notes.length === 0 ? (
        <Empty>
          Ideas, plans, lists, anything. Type or tap the mic and speak in English
          or Hindi.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty>No notes match “{query}”.</Empty>
      ) : (
        <ul className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((note) => (
            <li key={note.id}>
              <article className="flex h-full flex-col rounded-card border border-paper/10 bg-surface p-4">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => open(note)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="truncate font-serif text-lg leading-tight">
                      {note.title || note.body.split("\n")[0] || "Untitled"}
                    </h3>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePin(note)}
                    disabled={pending}
                    aria-pressed={note.pinned}
                    aria-label={note.pinned ? "Unpin note" : "Pin note"}
                    title={note.pinned ? "Unpin" : "Pin to top"}
                    className={`shrink-0 rounded-full px-2 py-1 text-sm transition ${
                      note.pinned ? "bg-ember/15" : "opacity-40 hover:opacity-100"
                    }`}
                  >
                    📌
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => open(note)}
                  className="mt-1 flex-1 text-left"
                >
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-paper/60">
                    {note.body || "No text yet"}
                  </p>
                  <p className="mt-2 text-xs text-paper/35">
                    {updated.format(new Date(note.updated_at))}
                  </p>
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit note" : "New note"}
        wide
        footer={
          <div className="flex gap-2">
            {draft?.id && (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="h-12 rounded-2xl px-4 text-sm text-paper/50 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={pending || (!draft?.title.trim() && !draft?.body.trim())}
              className={primaryButtonClass}
            >
              {pending ? "Saving…" : "Save note"}
            </button>
          </div>
        }
      >
        {draft && (
          <div className="flex flex-col gap-3">
            <input
              autoFocus={!draft.id}
              value={draft.title}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title"
              className={`${inputClass} font-serif text-xl`}
            />
            <div className="relative">
              <textarea
                value={draft.body}
                rows={12}
                maxLength={50000}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Write, or tap the mic and speak…"
                className={`${inputClass} h-auto resize-y py-2.5 pb-16 leading-relaxed`}
              />
              <div className="absolute bottom-2 left-2 right-2 flex justify-end">
                <VoiceInput
                  onText={(spoken) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            body: `${current.body}${current.body && !/\s$/.test(current.body) ? " " : ""}${spoken}`.slice(0, 50000),
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-paper/60">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                className="h-4 w-4 accent-[var(--ember)]"
              />
              Pin to top
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
