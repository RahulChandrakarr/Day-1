"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { setNotePinned } from "@/app/(dashboard)/plan/actions";
import { Empty, inputClass, primaryButtonClass } from "@/components/ui/kit";
import type { Note } from "@/lib/plans";

const updated = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

// Markdown to a plain-text preview for the cards
function preview(body: string) {
  return body
    .replace(/^```.*$/gm, "")
    .replace(/^\s*[-*+]\s+\[( |x)\]\s+/gim, (_, x: string) => (x.trim() ? "☑ " : "☐ "))
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^([-*_]\s*){3,}$/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|==|~~|\*|_|`)(.+?)\1/g, "$2")
    .replace(/\\$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function NotesBoard({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [notes, query]);

  function togglePin(note: Note) {
    startTransition(async () => {
      await setNotePinned(note.id, !note.pinned);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Link href="/plan/notes/new" className={primaryButtonClass}>
        ＋ New note
      </Link>

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
          Ideas, plans, lists, anything. Headings, to-dos, bold and highlights,
          or tap the mic and speak in English or Hindi.
        </Empty>
      ) : shown.length === 0 ? (
        <Empty>No notes match “{query}”.</Empty>
      ) : (
        <ul className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((note) => {
            const text = preview(note.body);
            return (
              <li key={note.id}>
                <article className="relative flex h-full flex-col rounded-card border border-paper/10 bg-surface p-4 transition hover:border-ember/40">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 truncate font-serif text-lg leading-tight">
                      <Link
                        href={`/plan/notes/${note.id}`}
                        className="after:absolute after:inset-0 after:rounded-card"
                      >
                        {note.title || text.split("\n")[0] || "Untitled"}
                      </Link>
                    </h3>
                    <button
                      type="button"
                      onClick={() => togglePin(note)}
                      disabled={pending}
                      aria-pressed={note.pinned}
                      aria-label={note.pinned ? "Unpin note" : "Pin note"}
                      title={note.pinned ? "Unpin" : "Pin to top"}
                      className={`relative z-10 shrink-0 rounded-full px-2 py-1 text-sm transition ${
                        note.pinned ? "bg-ember/15" : "opacity-40 hover:opacity-100"
                      }`}
                    >
                      📌
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-4 flex-1 whitespace-pre-line text-sm text-paper/60">
                    {text || "No text yet"}
                  </p>
                  <p className="mt-2 text-xs text-paper/35">
                    {updated.format(new Date(note.updated_at))}
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
