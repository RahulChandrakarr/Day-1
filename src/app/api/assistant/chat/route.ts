import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { buildAgent, financeSnapshot } from "@/lib/ai/domains";
import { compact } from "@/lib/ai/evidence";
import { answerModel, answerProviderOptions } from "@/lib/ai/models";
import { agentInstructions } from "@/lib/ai/prompts";
import { routeMessage } from "@/lib/ai/router";
import { getSchemaText } from "@/lib/ai/schema-cache";
import { firstName, getApiSession, jsonError } from "@/lib/ai/session";
import { todayCard } from "@/lib/ai/snapshot";
import type { AssistantAction, AssistantUIMessage } from "@/lib/ai/types";
import { todayISO } from "@/lib/finance";

export const maxDuration = 120;

const SECTION_STATUS: Record<string, string> = {
  daily: "Looking at your day…",
  plan: "Opening your plan…",
  health: "Checking your health…",
  finance: "Looking at your money…",
  documents: "Looking through your documents…",
  reports: "Putting your report together…",
  settings: "Checking your settings…",
};

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
  const [minute, day, conversation, history] =
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
    ]);

  if ((minute.count ?? 0) >= LIMIT_PER_MINUTE)
    return jsonError("You're sending messages quickly — wait a moment.", 429);
  if ((day.count ?? 0) >= LIMIT_PER_DAY)
    return jsonError("Daily message limit reached. Try again tomorrow.", 429);
  if (!conversation.data) return jsonError("Conversation not found", 404);

  const past = (history.data ?? []).reverse();
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

  const today = todayISO();

  const stream = createUIMessageStream<AssistantUIMessage>({
    onError: friendlyError,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const status = (label: string) =>
        writer.write({ type: "data-status", data: { label }, transient: true });
      status("Thinking…");

      // 1. Router picks the sections; the today card loads meanwhile.
      const [route, today_] = await Promise.all([
        routeMessage(historyMessages, text),
        todayCard(today).catch(() => null),
      ]);
      const sql = route.customQuery || route.sections.includes("finance");
      const [schema, finance] = await Promise.all([
        sql ? getSchemaText(supabase) : null,
        route.sections.includes("finance") ? financeSnapshot(supabase).catch(() => null) : null,
      ]);
      status(SECTION_STATUS[route.sections[0]] ?? "Thinking…");

      // 2. The section agent looks things up, makes changes and answers.
      const emit = (action: AssistantAction) =>
        writer.write({ type: "data-action", data: action, transient: true });
      const agent = buildAgent({ supabase, profile, today, emit }, route.sections, { sql });
      const announced = new Set<string>();

      const context = [
        `<today>${JSON.stringify(today_)}</today>`,
        finance ? `<finance>${JSON.stringify(finance)}</finance>` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const answer = streamText({
        model: answerModel,
        instructions: agentInstructions(firstName(profile), agent.prompts, schema),
        messages: [...historyMessages, { role: "user", content: `${context}\n\n${text}` }],
        tools: agent.tools,
        stopWhen: isStepCount(8),
        temperature: 0.3,
        maxOutputTokens: 1500,
        providerOptions: answerProviderOptions,
        onToolExecutionStart: ({ toolCall }) => {
          const label = agent.labels[toolCall.toolName];
          if (label && !announced.has(label)) {
            announced.add(label);
            status(label);
          }
        },
        onEnd: async ({ text: answerText, steps }) => {
          if (!answerText.trim()) return;
          const evidence = steps
            .flatMap((step) => step.toolResults)
            .map((r) => compact(r.toolName, r.input, r.output));
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: answerText.slice(0, 20000),
            evidence: evidence.length ? { sections: route.sections, tools: evidence } : null,
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
