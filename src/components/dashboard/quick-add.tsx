"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addTodos } from "@/app/(dashboard)/daily/actions";
import { saveNote } from "@/app/(dashboard)/plan/actions";
import VoiceInput from "@/components/journal/voice-input";
import Sheet from "@/components/ui/sheet";
import { inputClass, primaryButtonClass } from "@/components/ui/kit";
import { todayISO } from "@/lib/finance";

// The two quick forms behind the Add menu (see add-hub.tsx).

// Add one or more to-dos to today's list (the journal priorities)
export function TodoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    onClose();
    setRows([""]);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      // Today as of the tap, not as of when the app was opened
      const result = await addTodos(rows, todayISO());
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
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
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? e.target.value : r)))}
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
        <p className="text-xs text-paper/65">These show in today&apos;s journal priorities too.</p>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// A quick note saved to Plan → Notes
export function NoteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    onClose();
    setTitle("");
    setBody("");
    setError(null);
  }

  function save() {
    startTransition(async () => {
      const result = await saveNote({ title, body });
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
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
          onText={(spoken) => setBody((b) => (b.trim() ? `${b.trimEnd()} ${spoken}` : spoken))}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
