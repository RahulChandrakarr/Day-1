import "server-only";
import type { ToolSet } from "ai";
import { z } from "zod";
import type { Profile } from "@/lib/auth";
import { isValidDate } from "@/lib/finance";
import type { AssistantAction, Supabase } from "../types";

// What every tool gets: the signed-in user's client and a way to talk to the page.
export type ToolContext = {
  supabase: Supabase;
  profile: Profile;
  today: string;
  emit: (action: AssistantAction) => void;
};

export type Domain = {
  prompt: string;
  labels: Record<string, string>;
  tools: (ctx: ToolContext) => ToolSet;
};

export const dateInput = z
  .string()
  .refine(isValidDate, "Use YYYY-MM-DD")
  .describe("Date as YYYY-MM-DD");

export const monthInput = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
  .describe("Month as YYYY-MM");

// Deletes only go through once the user has said yes in the chat.
export const confirmedInput = z
  .boolean()
  .default(false)
  .describe("true ONLY after the user has explicitly confirmed this delete in the conversation");

export const NEEDS_CONFIRMATION = {
  needsConfirmation: true,
  message: "Nothing was deleted. Ask the user to confirm, then call again with confirmed: true.",
};

// Result of a write: tells the page to refresh and the model what changed.
export function changed(ctx: ToolContext, summary: string, extra: object = {}) {
  ctx.emit({ kind: "refresh" });
  return { done: true, summary, ...extra };
}

export function failed(error: string) {
  return { done: false, error };
}

// Tool errors go back to the model as data so it can correct itself.
export function safe<T extends ToolSet>(tools: T): T {
  for (const t of Object.values(tools)) {
    const execute = t.execute;
    if (!execute) continue;
    t.execute = async (input: unknown, options: unknown) => {
      try {
        return await (execute as (i: unknown, o: unknown) => unknown)(input, options);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Tool failed" };
      }
    };
  }
  return tools;
}

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

// Finds one item by id or by (partial) name; lists the options when unsure.
export function pick<T extends { id: string }>(
  items: T[],
  query: string,
  nameOf: (item: T) => string,
): { item: T } | { error: string } {
  const q = norm(query);
  const byId = items.find((i) => i.id === query);
  if (byId) return { item: byId };
  const exact = items.filter((i) => norm(nameOf(i)) === q);
  if (exact.length === 1) return { item: exact[0] };
  const partial = items.filter(
    (i) => norm(nameOf(i)).includes(q) || q.includes(norm(nameOf(i))),
  );
  if (partial.length === 1) return { item: partial[0] };
  const options = (partial.length ? partial : items).slice(0, 15).map(nameOf);
  return {
    error: `${partial.length ? "Several" : "No"} matches for "${query}". Options: ${options.join(", ") || "none"}.`,
  };
}

export function formData(values: Record<string, string | number | null | undefined>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined) form.set(key, String(value));
  return form;
}

export const INITIAL_FORM = { error: null, ok: false, version: 0 };

export const idInput = z.string().regex(/^[0-9a-f-]{36}$/i, "Use an id from an earlier result");
