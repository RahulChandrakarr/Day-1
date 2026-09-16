"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addTodos } from "@/app/(dashboard)/daily/actions";
import { saveNote } from "@/app/(dashboard)/plan/actions";
import VoiceInput from "@/components/journal/voice-input";
import Sheet from "@/components/ui/sheet";
import { inputClass, primaryButtonClass } from "@/components/ui/kit";

export const quickButtonClass =
  "flex h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-paper/10 bg-surface px-2 text-[15px] font-medium transition active:bg-ink";

// "To do" button: add one or more to-dos to today's list (the journal priorities).
export function AddTodoButton({ date }: { date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setRows([""]);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await addTodos(rows, date);
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={quickButtonClass}>
        <span aria-hidden>☑️</span> To do
      </button>
      <Sheet
        open={open}
        onClose={close}
        title="Today's to-dos"
        footer={
          <button
            type="button"
            onClick={save}
            disabled={pending || !rows.some((r) => r.trim())}
            className={`${primaryButtonClass} w-full`}
          >
            {pending ? "Saving…" : "Add to today"}
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <input
              key={i}
              autoFocus={i === rows.length - 1}
              value={row}
              maxLength={200}
              placeholder={i === 0 ? "What needs doing today?" : "Another to-do"}
              aria-label={`To-do ${i + 1}`}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? e.target.value : r)))
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (row.trim() && i === rows.length - 1) setRows([...rows, ""]);
              }}
              className={inputClass}
            />
          ))}
          <button
            type="button"
            onClick={() => setRows([...rows, ""])}
            className="self-start py-1 text-sm font-semibold text-ember"
          >
            + Another
          </button>
          <p className="text-xs text-paper/50">
            These show in today&apos;s journal priorities too.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}

// "Note" button: a quick note saved to Plan → Notes.
export function AddNoteButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setTitle("");
    setBody("");
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveNote({ title, body });
      if (!result.ok) return setError(result.error);
      close();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={quickButtonClass}>
        <span aria-hidden>{saved ? "✓" : "🗒️"}</span> {saved ? "Saved" : "Note"}
      </button>
      <Sheet
        open={open}
        onClose={close}
        title="New note"
        footer={
          <button
            type="button"
            onClick={save}
            disabled={pending || (!title.trim() && !body.trim())}
            className={`${primaryButtonClass} w-full`}
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            maxLength={120}
            placeholder="Title (optional)"
            aria-label="Title"
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
          <textarea
            value={body}
            rows={6}
            placeholder="Write or speak your note…"
            aria-label="Note"
            onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} h-auto resize-y py-2.5`}
          />
          <VoiceInput
            onText={(spoken) =>
              setBody((b) => (b.trim() ? `${b.trimEnd()} ${spoken}` : spoken))
            }
          />
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </>
  );
}
