"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteMemoryAction,
  renameAssistantAction,
  saveMemoryAction,
} from "@/app/(dashboard)/settings/actions";
import { Card, CardGrid, CardHead, Field, inputClass, primaryButtonClass, quietButtonClass } from "@/components/ui/kit";
import type { Memory } from "@/lib/assistant-memory";

type Message = { ok: boolean; text: string } | null;

function Status({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={`text-sm ${message.ok ? "text-moss" : "text-red-700 dark:text-red-300"}`}
    >
      {message.text}
    </p>
  );
}

export default function AssistantSettings({
  name,
  memories,
}: {
  name: string;
  memories: Memory[];
}) {
  return (
    <CardGrid>
      <NameCard name={name} />
      <MemoryCard name={name} memories={memories} />
    </CardGrid>
  );
}

function NameCard({ name }: { name: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHead title="Name" />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          startTransition(async () => {
            const result = await renameAssistantAction(draft);
            setMessage(result.ok ? { ok: true, text: `She's ${draft.trim()} now.` } : { ok: false, text: result.error });
            if (result.ok) router.refresh();
          });
        }}
      >
        <Field label="What you call your assistant">
          <input
            value={draft}
            maxLength={20}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Romi"
            className={inputClass}
          />
        </Field>
        <Status message={message} />
        <button
          type="submit"
          disabled={pending || !draft.trim() || draft.trim() === name}
          className={quietButtonClass}
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </form>
    </Card>
  );
}

function MemoryCard({ name, memories }: { name: string; memories: Memory[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHead title={`What ${name} knows about you`} aside={memories.length ? `${memories.length}` : undefined} />
      <p className="-mt-1 mb-3 text-sm text-paper/70">
        Tell her things like your birthday, family or what you like, and she&apos;ll remember them.
        Edit or delete anything here.
      </p>
      {memories.length === 0 && !adding && (
        <p className="card px-4 py-6 text-center text-sm text-paper/60">
          Nothing yet. Try saying &ldquo;{name}, my date of birth is 12 May 1998&rdquo;.
        </p>
      )}
      {memories.length > 0 && (
        <ul className="divide-y divide-paper/5">
          {memories.map((m) => (
            <MemoryRow key={m.id} memory={m} />
          ))}
        </ul>
      )}
      {adding ? (
        <MemoryForm onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={`${quietButtonClass} mt-3 w-full`}>
          + Add a fact
        </button>
      )}
    </Card>
  );
}

function MemoryRow({ memory }: { memory: Memory }) {
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) return <li className="py-3"><MemoryForm memory={memory} onDone={() => setEditing(false)} /></li>;

  return (
    <li className={`flex items-start gap-3 py-3 ${deleting ? "opacity-40" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-paper/65">{memory.label}</p>
        <p className="break-words font-medium">{memory.value}</p>
        {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded-lg px-2 py-1 text-sm text-paper/72 hover:bg-paper/5 hover:text-paper"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={deleting}
        aria-label={`Forget ${memory.label}`}
        onClick={() => {
          if (!confirm(`Forget "${memory.label}"?`)) return;
          startDelete(async () => {
            const result = await deleteMemoryAction(memory.id);
            if (!result.ok) setError(result.error);
          });
        }}
        className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-500/10 dark:text-red-300"
      >
        Forget
      </button>
    </li>
  );
}

function MemoryForm({ memory, onDone }: { memory?: Memory; onDone: () => void }) {
  const [label, setLabel] = useState(memory?.label ?? "");
  const [value, setValue] = useState(memory?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveMemoryAction({ id: memory?.id ?? null, label, value });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Field label="What it is">
          <input
            value={label}
            maxLength={60}
            autoFocus={!memory}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Date of birth"
            className={inputClass}
          />
        </Field>
        <Field label="The fact">
          <input
            value={value}
            maxLength={300}
            onChange={(e) => setValue(e.target.value)}
            placeholder="12 May 1998"
            className={inputClass}
          />
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className={quietButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={pending || !label.trim() || !value.trim()} className={`${primaryButtonClass} min-h-11 flex-1`}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
