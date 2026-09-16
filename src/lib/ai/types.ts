import type { UIMessage } from "ai";
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Evidence = {
  tool: string;
  input: unknown;
  output: unknown;
};

// Things the assistant asks the open page to do.
export type AssistantAction =
  | { kind: "theme"; value: "light" | "dark" }
  | { kind: "refresh" };

// Chat messages carry transient "status" (what the agent is doing) and
// "action" (theme change, page refresh) data parts.
export type AssistantUIMessage = UIMessage<
  never,
  { status: { label: string }; action: AssistantAction }
>;
