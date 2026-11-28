import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from "ai";
import { after } from "next/server";
import { z } from "zod";
import {
  getChatSummaries,
  looksLikePastReference,
  referenceQuery,
  refreshChatSummary,
  searchChatHistory,
} from "@/lib/ai/chat-memory";
import { buildAgent, financeSnapshot, SECTION_NAMES, type Section } from "@/lib/ai/domains";
import { resolvePersona } from "@/lib/ai/persona-queries";
import { compact } from "@/lib/ai/evidence";
import { answerModel, answerProviderOptions } from "@/lib/ai/models";
import { agentInstructions } from "@/lib/ai/prompts";
import { looksLikeDocuments, looksLikeFollowUp, looksLikeJobs, looksLikeSong, looksLikeWatch, routeMessage, type RouteDecision } from "@/lib/ai/router";
import { getAssistantName, getMemories, MEMORY_LIMIT } from "@/lib/assistant-memory";
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
  world: "Looking it up…",
  jobs: "Looking for openings…",
  watch: "Opening Watch…",
};

const Body = z.object({
  conversationId: z.uuid(),
  text: z.string().trim().min(1).max(2000),
  mode: z.enum(["ask", "talk"]).default("ask"),
  personaId: z.string().max(40).optional(),
  // The floating quick button keeps one ongoing chat under this title
  source: z.enum(["quick"]).optional(),
});

// Old turns are context, not the question; a long report from earlier
// shouldn't be paid for again on every message.
const HISTORY_CHARS = 1800;
const HISTORY_TURNS = 20;
// A spoken conversation has short messages and needs more of them for context
const TALK_HISTORY_TURNS = 32;

const LIMIT_PER_MINUTE = 8;
const TALK_LIMIT_PER_MINUTE = 15;

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
  const { conversationId, text, mode, personaId, source } = parsed.data;

  const since = (ms: number) => new Date(Date.now() - ms).toISOString();
  const countSince = (ms: number) =>
    supabase
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .gte("created_at", since(ms));

  // Everything independent runs in parallel.
  const [minute, day, conversation, history, persona, assistantName, memories, chatNotes] =
    await Promise.all([
      countSince(60_000),
      countSince(86_400_000),
      supabase
        .from("ai_conversations")
        .upsert(
          {
            id: conversationId,
            title: source === "quick" ? "Quick assistant" : text.slice(0, 60),
            persona: personaId ?? "assistant",
          },
          { onConflict: "id", ignoreDuplicates: true },
        )
        .then(() =>
          supabase
            .from("ai_conversations")
            .select("id, summary, last_sections")
            .eq("id", conversationId)
            .maybeSingle<{
              id: string;
              summary: string | null;
              last_sections: string[] | null;
            }>(),
        ),
      supabase
        .from("ai_messages")
        .select("role, content, evidence")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(mode === "talk" ? TALK_HISTORY_TURNS : HISTORY_TURNS),
      resolvePersona(supabase, personaId),
      getAssistantName(supabase).catch(() => undefined),
      getMemories(supabase, MEMORY_LIMIT).catch(() => []),
      getChatSummaries(supabase).catch(() => []),
    ]);

  if ((minute.count ?? 0) >= (mode === "talk" ? TALK_LIMIT_PER_MINUTE : LIMIT_PER_MINUTE))
    return jsonError("You're sending messages quickly — wait a moment.", 429);
  if ((day.count ?? 0) >= LIMIT_PER_DAY)
    return jsonError("Daily message limit reached. Try again tomorrow.", 429);
  if (!conversation.data) return jsonError("Conversation not found", 404);

  const past = (history.data ?? []).reverse();
  const historyMessages: ModelMessage[] = past.map((m) => ({
    role: m.role as "user" | "assistant",
    content:
      m.content.length > HISTORY_CHARS ? `${m.content.slice(0, HISTORY_CHARS)}…` : m.content,
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

      // 1. The persona limits the sections; the router picks among them.
      const allowed: Section[] =
        persona.sections === "all" ? SECTION_NAMES : persona.sections;
      const previous = (conversation.data?.last_sections ?? []).filter((s): s is Section =>
        (SECTION_NAMES as string[]).includes(s),
      );
      const referringBack = looksLikePastReference(text);
      const lookBack = referringBack ? referenceQuery(text) : "";
      if (referringBack) status("Looking through earlier chats…");
      const [route, today_, related] = await Promise.all([
        allowed.length > 1
          ? routeMessage(historyMessages, text, allowed, previous)
          : // Single-area personas (like a teacher) keep their usual depth
            Promise.resolve<RouteDecision>({ sections: allowed, customQuery: false, detail: "full" }),
        // Personas without data access don't get the day's details.
        // A song request shouldn't load today's to-dos into the prompt.
        allowed.length && !looksLikeSong(text) && !looksLikeJobs(text) && !looksLikeWatch(text)
          ? todayCard(today).catch(() => null)
          : null,
        lookBack
          ? searchChatHistory(supabase, lookBack, conversationId).catch(() => null)
          : Promise.resolve(null),
      ]);
      const brief = route.detail === "brief";
      const followUp = looksLikeFollowUp(text) && previous.length > 0;
      const sections =
        allowed.includes("world") && !route.sections.includes("world")
          ? [...route.sections, "world" as Section]
          : route.sections;
      const worldOnly = route.sections.every((s) => s === "world" || s === "jobs" || s === "watch");
      const studying = looksLikeDocuments(text) || route.sections.includes("documents");
      // The month-wide finance picture and the table list are big; only load
      // them when the question needs them (tools cover everything else).
      // A song or a world question must not dump today's to-dos into the prompt.
      const sql = route.customQuery && !worldOnly && !followUp;
      const [schema, finance] = await Promise.all([
        sql ? getSchemaText(supabase) : null,
        route.sections.includes("finance") && !brief && !worldOnly && !followUp
          ? financeSnapshot(supabase).catch(() => null)
          : null,
      ]);
      if (sections.length) status(SECTION_STATUS[sections[0]] ?? "Thinking…");
      await supabase
        .from("ai_conversations")
        .update({ last_sections: route.sections })
        .eq("id", conversationId);

      // 2. The section agent looks things up, makes changes and answers.
      const emit = (action: AssistantAction) =>
        writer.write({ type: "data-action", data: action, transient: true });
      const agent = buildAgent({ supabase, profile, today, emit }, sections, { sql });
      const announced = new Set<string>();

      // What the user has told the assistant about themselves
      const known = sections.length
        ? memories.map(({ label, value }) => ({ label, value }))
        : [];
      const pastNotes = chatNotes
        .filter((n) => n.conversation_id !== conversationId)
        .slice(0, 8)
        .map(({ title, summary }) => ({ title, summary: summary.slice(0, 400) }));
      const thisThread = past
        .filter((m) => m.role === "user")
        .slice(-8)
        .map((m) => m.content.slice(0, 220));
      const relatedHits =
        related && (related.summaries.length || related.mentions.length) ? related : null;
      const context = [
        today_ && !worldOnly && !followUp ? `<today>${JSON.stringify(today_)}</today>` : "",
        known.length ? `<memory>${JSON.stringify(known)}</memory>` : "",
        conversation.data?.summary
          ? `<this_chat>${conversation.data.summary}</this_chat>`
          : "",
        thisThread.length ? `<this_thread>${JSON.stringify(thisThread)}</this_thread>` : "",
        pastNotes.length ? `<past_chats>${JSON.stringify(pastNotes)}</past_chats>` : "",
        relatedHits ? `<related>${JSON.stringify(relatedHits)}</related>` : "",
        finance ? `<finance>${JSON.stringify(finance)}</finance>` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const answer = streamText({
        model: answerModel,
        instructions: agentInstructions(firstName(profile), agent.prompts, schema, mode, {
          name: persona.name,
          instructions: persona.instructions,
          hasTools: sections.length > 0,
          isDefault: persona.id === "assistant",
          assistantName,
        }, worldOnly ? "full" : route.detail),
        messages: [...historyMessages, { role: "user", content: `${context}\n\n${text}` }],
        tools: sections.length ? agent.tools : undefined,
        stopWhen: isStepCount(worldOnly || studying ? 10 : 8),
        temperature: 0.3,
        maxOutputTokens: mode === "talk"
          ? worldOnly || studying
            ? 1800
            : brief
              ? 300
              : 600
          : worldOnly || studying
            ? 2500
            : brief
              ? 350
              : 1500,
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
          try {
            const evidence = (steps ?? [])
              .flatMap((step) => step.toolResults ?? [])
              .map((r) => compact(r.toolName, r.input, r.output));
            await supabase.from("ai_messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: answerText.slice(0, 20000),
              evidence: evidence.length
                ? { persona: persona.id, sections: route.sections, tools: evidence }
                : null,
            });
          } catch (error) {
            console.error("[assistant] couldn't save the reply:", error);
          }
          after(() =>
            refreshChatSummary(
              supabase,
              conversationId,
              memories.map((m) => m.label),
            ),
          );
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
