import type { UIMessage } from "ai";
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Evidence = {
  tool: string;
  input: unknown;
  output: unknown;
};

// Chat messages carry a transient "status" data part while the data agent works.
export type AssistantUIMessage = UIMessage<
  never,
  { status: { label: string } }
>;
