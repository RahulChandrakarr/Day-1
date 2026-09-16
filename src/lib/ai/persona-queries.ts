import "server-only";
import {
  builtInPersona,
  BUILT_IN_PERSONAS,
  customPersona,
  type CustomPersonaRow,
  type Persona,
} from "./personas";
import type { Supabase } from "./types";

const COLUMNS = "id, name, emoji, instructions, sections, language";
const uuid = /^[0-9a-f-]{36}$/i;

export async function listPersonas(supabase: Supabase): Promise<Persona[]> {
  const { data } = await supabase
    .from("assistant_personas")
    .select(COLUMNS)
    .order("created_at")
    .returns<CustomPersonaRow[]>();
  return [...BUILT_IN_PERSONAS, ...(data ?? []).map(customPersona)];
}

// A built-in by key, or one of the user's own by id; falls back to the default.
export async function resolvePersona(supabase: Supabase, id: string | undefined): Promise<Persona> {
  const builtIn = id ? builtInPersona(id) : null;
  if (builtIn) return builtIn;
  if (id && uuid.test(id)) {
    const { data } = await supabase
      .from("assistant_personas")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle<CustomPersonaRow>();
    if (data) return customPersona(data);
  }
  return BUILT_IN_PERSONAS[0];
}
