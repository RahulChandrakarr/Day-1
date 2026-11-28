import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { searchChatHistory } from "../chat-memory";
import { forgetMemory, saveMemory } from "@/lib/assistant-memory";
import { todayCard } from "../snapshot";
import { changed, confirmedInput, failed, NEEDS_CONFIRMATION, type ToolContext } from "./common";

export const sharedLabels: Record<string, string> = {
  get_today: "Looking at today…",
  get_profile: "Checking your profile…",
  run_sql: "Digging through your data…",
  list_users: "Looking up users…",
  remember_fact: "Noting that down…",
  forget_fact: "Forgetting that…",
  search_past_chats: "Looking through earlier chats…",
};

export function sharedTools(ctx: ToolContext, { sql }: { sql: boolean }) {
  return {
    get_today: tool({
      description: "Fresh snapshot of today (to-dos, plan tasks, workout, habits, journal, money). Use after changes.",
      inputSchema: z.object({}),
      execute: async () => todayCard(ctx.today),
    }),

    remember_fact: tool({
      description:
        "Save a lasting fact the user told you about themselves (date of birth, family, work, likes, allergies, health, exam dates, important dates, long-term goals). The same label replaces the old value. Not for tasks, notes or passing moods.",
      inputSchema: z.object({
        label: z.string().min(1).max(60).describe('Short kind of fact, e.g. "Date of birth", "Wife\'s name", "Favourite food"'),
        value: z.string().min(1).max(300).describe('The fact itself, e.g. "12 May 1998"'),
      }),
      execute: async ({ label, value }) => {
        const result = await saveMemory(ctx.supabase, { label, value });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Remembered: ${result.label} — ${value}.`);
      },
    }),

    search_past_chats: tool({
      description:
        "Search earlier chats (lasting summaries and the last 30 days of messages) for something they mentioned before — exam dates, plans, names, decisions. Use this when they say 'I already told you', 'check previous history', or ask about an old chat.",
      inputSchema: z.object({
        query: z.string().min(2).max(80).describe('Words to find, e.g. "exam dates" or "Richa"'),
      }),
      execute: async ({ query }) => searchChatHistory(ctx.supabase, query),
    }),

    forget_fact: tool({
      description: "Delete a remembered fact about the user, by its label. Only after they confirm.",
      inputSchema: z.object({ label: z.string().min(1).max(60), confirmed: confirmedInput }),
      execute: async ({ label, confirmed }) => {
        if (!confirmed) return NEEDS_CONFIRMATION;
        const result = await forgetMemory(ctx.supabase, { label });
        if (!result.ok) return failed(result.error);
        if (!result.removed) return failed(`No remembered fact called "${label}".`);
        return changed(ctx, `Forgot ${label}.`);
      },
    }),

    get_profile: tool({
      description: "The signed-in user's name, email and role.",
      inputSchema: z.object({}),
      execute: async () => ({
        name: ctx.profile.full_name,
        email: ctx.profile.email,
        role: ctx.profile.role,
      }),
    }),

    ...(sql
      ? {
          run_sql: tool({
            description:
              "Run ONE read-only PostgreSQL SELECT/WITH query over the tables listed in the prompt (RLS limits it to this user's data). Only for questions the other tools can't answer (e.g. weekday patterns, custom groupings). Filter by date and aggregate in SQL. Max 200 rows. No comments or semicolons.",
            inputSchema: z.object({ query: z.string().min(8).max(4000) }),
            execute: async ({ query }) => {
              const { data, error } = await ctx.supabase
                .rpc("ai_readonly_query", { q: query }, { get: true })
                .abortSignal(AbortSignal.timeout(6000));
              if (error) return { error: error.message };
              return { rows: data };
            },
          }),
        }
      : {}),

    ...(ctx.profile.role === "admin"
      ? {
          list_users: tool({
            description: "Admin only: everyone who can sign in to the app.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await ctx.supabase
                .from("profiles")
                .select("email, full_name, role, created_at")
                .order("created_at");
              if (error) return { error: error.message };
              return data;
            },
          }),
        }
      : {}),
  };
}
