"use server";

import { revalidatePath } from "next/cache";
import { PERSONA_SECTIONS, type PersonaSection } from "@/lib/ai/personas";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; id: string } | { ok: false; error: string };
const uuid = /^[0-9a-f-]{36}$/i;
const SECTIONS = PERSONA_SECTIONS.map((s) => s.value) as string[];

export async function savePersona(input: {
  id?: string;
  name: string;
  emoji: string;
  instructions: string;
  sections: PersonaSection[];
  language: "en-IN" | "hi-IN";
}): Promise<Result> {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) return { ok: false, error: "Give the persona a name." };
  const instructions = String(input.instructions ?? "").trim().slice(0, 4000);
  if (!instructions) return { ok: false, error: "Describe how it should behave." };
  const row = {
    name,
    emoji: [...String(input.emoji ?? "").trim()].slice(0, 2).join("") || "✨",
    instructions,
    sections: [...new Set((input.sections ?? []).filter((s) => SECTIONS.includes(s)))],
    language: input.language === "hi-IN" ? "hi-IN" : "en-IN",
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (input.id) {
    if (!uuid.test(input.id)) return { ok: false, error: "Unknown persona." };
    const { error } = await supabase.from("assistant_personas").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/assistant");
    return { ok: true, id: input.id };
  }
  const { data, error } = await supabase
    .from("assistant_personas")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/assistant");
  return { ok: true, id: data.id };
}

export async function deletePersona(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!uuid.test(id)) return { ok: false, error: "Unknown persona." };
  const supabase = await createClient();
  const { error } = await supabase.from("assistant_personas").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/assistant");
  return { ok: true };
}
