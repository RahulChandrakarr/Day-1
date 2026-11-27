"use client";

import { useState, useTransition } from "react";
import { deletePersona, savePersona } from "@/app/(dashboard)/assistant/actions";
import VoiceInput from "@/components/journal/voice-input";
import { Field, inputClass, primaryButtonClass } from "@/components/ui/kit";
import {
  PERSONA_SECTIONS,
  type Persona,
  type PersonaSection,
  type VoiceLang,
} from "@/lib/ai/personas";

const EMOJIS = ["✨", "🧑‍🏫", "🗣️", "💼", "🧘", "🍳", "📚", "🧠", "❤️", "🎯", "🎸", "🌍"];

const EXAMPLE =
  "You are my Spanish tutor. Talk with me in simple Spanish, translate hard words into English, and correct my mistakes gently at the end of each reply.";

// Create or edit a custom persona.
export default function PersonaForm({
  persona,
  onSaved,
  onDeleted,
}: {
  persona: Persona | null;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(persona?.name ?? "");
  const [emoji, setEmoji] = useState(persona?.emoji ?? "✨");
  const [instructions, setInstructions] = useState(persona?.instructions ?? "");
  const [sections, setSections] = useState<PersonaSection[]>(
    persona && persona.sections !== "all" ? persona.sections : [],
  );
  const [language, setLanguage] = useState<VoiceLang>(persona?.language ?? "en-IN");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(section: PersonaSection) {
    setSections((list) =>
      list.includes(section) ? list.filter((s) => s !== section) : [...list, section],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await savePersona({
        id: persona?.id,
        name,
        emoji,
        instructions,
        sections,
        language,
      });
      if (!result.ok) return setError(result.error);
      onSaved(result.id);
    });
  }

  function remove() {
    if (!persona || !window.confirm(`Delete "${persona.name}"? Its past chats stay, using the default assistant.`))
      return;
    startTransition(async () => {
      const result = await deletePersona(persona.id);
      if (!result.ok) return setError(result.error ?? "Couldn't delete.");
      onDeleted();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <Field label="Emoji">
          <select
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className={`${inputClass} w-16 px-2 text-center text-lg`}
            aria-label="Emoji"
          >
            {[...new Set([emoji, ...EMOJIS])].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <input
            value={name}
            maxLength={40}
            placeholder="e.g. Spanish tutor"
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-medium text-paper/70">How should it behave?</span>
          <VoiceInput
            onText={(spoken) =>
              setInstructions((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}${spoken}`.slice(0, 4000))
            }
          />
        </div>
        <textarea
          value={instructions}
          rows={6}
          maxLength={4000}
          placeholder={EXAMPLE}
          onChange={(e) => setInstructions(e.target.value)}
          className={`${inputClass} h-auto resize-y py-2.5 leading-relaxed`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">Voice language</span>
        <div className="flex gap-2">
          {(
            [
              { value: "en-IN", label: "English" },
              { value: "hi-IN", label: "हिंदी" },
            ] as const
          ).map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition ${
                language === l.value ? "bg-paper text-ink" : "border border-paper/10 text-paper/75"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-paper/70">
          What can it see and change? <span className="text-paper/55">(none = conversation only)</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {PERSONA_SECTIONS.map((s) => {
            const on = sections.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(s.value)}
                className={`h-9 rounded-full px-3 text-[13px] font-medium transition ${
                  on ? "bg-ember text-on-ember" : "border border-paper/10 text-paper/75"
                }`}
              >
                {on ? "✓ " : ""}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending} className={`${primaryButtonClass} flex-1`}>
          {pending ? "Saving…" : persona ? "Save changes" : "Create persona"}
        </button>
        {persona && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="min-h-12 rounded-2xl border border-paper/10 px-4 text-sm font-semibold text-red-700 dark:text-red-300"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
