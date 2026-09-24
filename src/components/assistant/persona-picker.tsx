"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Sheet from "@/components/ui/sheet";
import type { Persona } from "@/lib/ai/personas";
import { useAssistant } from "./chat-provider";
import PersonaForm from "./persona-form";

type View = { kind: "list" } | { kind: "edit"; persona: Persona | null };

// Header chip that opens the persona list; custom personas can be made and edited.
export default function PersonaPicker() {
  const router = useRouter();
  const { persona, personas, choosePersona } = useAssistant();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "list" });

  function close() {
    setOpen(false);
    setView({ kind: "list" });
  }

  function pick(id: string) {
    if (id !== persona.id) choosePersona(id);
    close();
  }

  const builtIns = personas.filter((p) => !p.custom);
  const custom = personas.filter((p) => p.custom);

  const row = (p: Persona) => (
    <li key={p.id} className="flex items-center gap-1 border-b border-paper/[0.06] last:border-0">
      <button
        type="button"
        onClick={() => pick(p.id)}
        aria-current={p.id === persona.id}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper/[0.06] text-xl" aria-hidden>
          {p.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{p.name}</span>
          <span className="block truncate text-xs text-paper/50">{p.tagline}</span>
        </span>
        {p.id === persona.id && <span className="text-sm font-bold text-ember">✓</span>}
      </button>
      {p.custom && (
        <button
          type="button"
          onClick={() => setView({ kind: "edit", persona: p })}
          aria-label={`Edit ${p.name}`}
          className="mr-1 flex h-10 w-10 items-center justify-center rounded-full text-paper/50 hover:bg-paper/10 hover:text-paper"
        >
          ✎
        </button>
      )}
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${persona.name} — change persona`}
        aria-label={`Persona: ${persona.name}. Change`}
        className="flex h-10 min-w-0 max-w-[9.5rem] shrink-0 items-center gap-1.5 rounded-xl border border-paper/10 bg-surface pl-1 pr-2 transition hover:bg-paper/5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-lg" aria-hidden>
          {persona.emoji}
        </span>
        {/* The default assistant needs no label; other personas show their name */}
        {persona.id !== "assistant" && (
          <span className="truncate text-sm font-semibold">{persona.name}</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0 text-paper/45">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={
          view.kind === "list" ? "Choose a persona" : view.persona ? `Edit ${view.persona.name}` : "New persona"
        }
      >
        {view.kind === "list" ? (
          <div className="flex flex-col gap-4">
            <ul className="overflow-hidden rounded-card border border-paper/10">{builtIns.map(row)}</ul>
            {custom.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="px-1 text-xs font-medium text-paper/55">Your personas</p>
                <ul className="overflow-hidden rounded-card border border-paper/10">{custom.map(row)}</ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => setView({ kind: "edit", persona: null })}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-paper/20 text-sm font-semibold text-ember transition hover:border-ember/60"
            >
              + New persona
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setView({ kind: "list" })}
              className="self-start text-sm font-semibold text-paper/55 hover:text-paper"
            >
              ← All personas
            </button>
            <PersonaForm
              key={view.persona?.id ?? "new"}
              persona={view.persona}
              onSaved={(id) => {
                router.refresh();
                // The new list arrives with the refresh; the chat switches once it's there
                setTimeout(() => choosePersona(id), 600);
                close();
              }}
              onDeleted={() => {
                router.refresh();
                if (view.persona?.id === persona.id) choosePersona("assistant");
                setView({ kind: "list" });
              }}
            />
          </div>
        )}
      </Sheet>
    </>
  );
}
