import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Profile } from "@/lib/auth";
import type { Supabase } from "../types";
import {
  financeBriefingContext,
  financeSnapshot,
  financeTools,
} from "./finance";

// Tool errors go back to the model as data so it can correct itself.
function safe<T extends ToolSet>(tools: T): T {
  for (const t of Object.values(tools)) {
    const execute = t.execute;
    if (!execute) continue;
    t.execute = async (input: unknown, options: unknown) => {
      try {
        return await (execute as (i: unknown, o: unknown) => unknown)(
          input,
          options,
        );
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Tool failed",
        };
      }
    };
  }
  return tools;
}

export function buildTools(supabase: Supabase, profile: Profile): ToolSet {
  const tools: ToolSet = {
    ...financeTools(),

    get_profile: tool({
      description: "The signed-in user's name, email and role.",
      inputSchema: z.object({}),
      execute: async () => ({
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
      }),
    }),

    run_sql: tool({
      description:
        "Run ONE read-only PostgreSQL SELECT/WITH query over the tables in the schema (RLS limits it to this user's data). Use for anything the other tools can't answer. Always filter by date and aggregate in SQL. Max 200 rows. No comments or semicolons.",
      inputSchema: z.object({ query: z.string().min(8).max(4000) }),
      execute: async ({ query }) => {
        const { data, error } = await supabase
          .rpc("ai_readonly_query", { q: query }, { get: true })
          .abortSignal(AbortSignal.timeout(6000));
        if (error) return { error: error.message };
        return { rows: data };
      },
    }),

    done: tool({
      description:
        "Signal that every needed data tool has been called. Call it in the SAME batch as the data tools, or alone when no data is needed.",
      inputSchema: z.object({}),
      execute: async () => "ok",
    }),

    ...(profile.role === "admin"
      ? {
          list_users: tool({
            description: "Admin only: everyone who can sign in to the app.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
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
  return safe(tools);
}

// Data every answer starts with. Add each new domain's snapshot here.
export async function buildSnapshot(supabase: Supabase) {
  const [finance] = await Promise.all([financeSnapshot(supabase)]);
  return { finance };
}

export async function buildBriefingContext(supabase: Supabase) {
  const [finance] = await Promise.all([financeBriefingContext(supabase)]);
  return { finance };
}
