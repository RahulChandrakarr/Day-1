import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { buildSnapshot } from "@/lib/ai/domains";
import { answerModel, answerProviderOptions } from "@/lib/ai/models";
import { runDataAgent } from "@/lib/ai/pipeline";
import { answerInstructions } from "@/lib/ai/prompts";
import { getSchemaText } from "@/lib/ai/schema-cache";
import { firstName, getApiSession, jsonError } from "@/lib/ai/session";
import type { AssistantUIMessage } from "@/lib/ai/types";

export const maxDuration = 60;

const Body = z.object({
  conversationId: z.uuid(),
  text: z.string().trim().min(1).max(2000),
});

const LIMIT_PER_MINUTE = 8;

function friendlyError(error: unknown) {
  console.error("[assistant] chat stream error:", error);
  const message = error instanceof Error ? error.message : String(error);
  if (/credit/i.test(message))
    return "The AI service is out of credits. Add credits to the OpenRouter account and try again.";
  return "Sorry — something went wrong while answering. Please try again.";
}
const LIMIT_PER_DAY = 200;

export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);
  const { supabase, profile } = session;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);
  const { conversationId, text } = parsed.data;

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const countSince = (ms: number) =>
    supabase
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", since(ms));

  // Everything independent runs in parallel.
  const [minute, day, conversation, history, snapshot, schema] =
    await Promise.all([
      countSince(60_000),
      countSince(86_400_000),
      supabase
        .from("ai_conversations")
        .upsert(
          { id: conversationId, title: text.slice(0, 60) },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .then(() =>
          supabase
            .from("ai_conversations")
            .select("id")
            .eq("id", conversationId)
            .maybeSingle(),
        ),
      supabase
        .from("ai_messages")
        .select("role, content, evidence")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(12),
      buildSnapshot(supabase),
      getSchemaText(supabase),
    ]);

  if ((minute.count ?? 0) >= LIMIT_PER_MINUTE)
    return jsonError("You're sending messages quickly — wait a moment.", 429);
  if ((day.count ?? 0) >= LIMIT_PER_DAY)
    return jsonError("Daily message limit reached. Try again tomorrow.", 429);
  if (!conversation.data) return jsonError("Conversation not found", 404);

  const past = (history.data ?? []).reverse();
  const priorEvidence = [...past]
    .reverse()
    .find((m) => m.role === "assistant" && m.evidence)?.evidence;
  const historyMessages: ModelMessage[] = past.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // A retry resends the last question; don't store it twice.
  const lastStored = past[past.length - 1];
  const isRetry = lastStored?.role === "user" && lastStored.content === text;
  if (isRetry) historyMessages.pop();
  else {
    const { error: insertError } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conversationId, role: "user", content: text });
    if (insertError) return jsonError("Couldn't save your message", 500);
  }

  const stream = createUIMessageStream<AssistantUIMessage>({
    onError: friendlyError,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const status = (label: string) =>
        writer.write({ type: "data-status", data: { label }, transient: true });
      status("Thinking…");

      // Stage 1: gather data
      const { evidence } = await runDataAgent({
        supabase,
        profile,
        schema,
        snapshot,
        history: historyMessages,
        priorEvidence,
        userText: text,
        onStatus: status,
      });
      if (evidence.length) status("Writing your answer…");

      // Stage 2: answer (keeps running and saves even if the tab closes)
      const answer = streamText({
        model: answerModel,
        instructions: answerInstructions(firstName(profile)),
        messages: [
          ...historyMessages,
          {
            role: "user",
            content: `<data>${JSON.stringify({ snapshot, evidence })}</data>\n\n${text}`,
          },
        ],
        temperature: 0.3,
        maxOutputTokens: 1200,
        providerOptions: answerProviderOptions,
        onEnd: async ({ text: answerText }) => {
          if (!answerText.trim()) return;
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: answerText.slice(0, 20000),
            evidence: evidence.length ? evidence : null,
          });
        },
      });
      answer.consumeStream();

      writer.merge(
        toUIMessageStream({
          stream: answer.stream,
          sendStart: false,
          onError: friendlyError,
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
