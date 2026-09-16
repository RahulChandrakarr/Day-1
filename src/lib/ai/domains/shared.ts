import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { todayCard } from "../snapshot";
import type { ToolContext } from "./common";

export const sharedLabels: Record<string, string> = {
  get_today: "Looking at today…",
  get_profile: "Checking your profile…",
  run_sql: "Digging through your data…",
  list_users: "Looking up users…",
};

export function sharedTools(ctx: ToolContext, { sql }: { sql: boolean }) {
  return {
    get_today: tool({
      description: "Fresh snapshot of today (to-dos, plan tasks, workout, habits, journal, money). Use after changes.",
      inputSchema: z.object({}),
      execute: async () => todayCard(ctx.today),
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
