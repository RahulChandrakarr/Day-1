import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { saveMemory } from "@/lib/assistant-memory";
import { dataModel } from "./models";
import type { Supabase } from "./types";

export const MESSAGE_KEEP_DAYS = 30;
const SUMMARY_LIMIT = 12;
const MAX_SUMMARY = 1500;

export type ChatSummary = {
  conversation_id: string | null;
  title: string;
  summary: string;
  updated_at: string;
};

export async function getChatSummaries(
  supabase: Supabase,
  limit = SUMMARY_LIMIT,
): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from("ai_chat_summaries")
    .select("conversation_id, title, summary, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)
    .returns<ChatSummary[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

function escapeIlike(query: string) {
  return query.replace(/[%_\\]/g, (c) => `\\${c}`);
}

const PAST_REF =
  /previous|earlier|last (chat|time|conversation)|old chat|other chat|pehle|पहले|पिछली|already (told|said|mentioned)|i (told|mentioned|said)|check (my )?(history|previous)|us chat|that chat|woh wala|mentioned|bataya|बताया|bole the|bola tha|kaha tha|कहा था|बोला था|history there|in (that|the other) chat/i;

const FILLER = new Set([
  "can",
  "you",
  "could",
  "please",
  "check",
  "my",
  "the",
  "a",
  "an",
  "previous",
  "history",
  "there",
  "i",
  "we",
  "mentioned",
  "told",
  "already",
  "said",
  "about",
  "for",
  "from",
  "in",
  "our",
  "chat",
  "conversation",
  "that",
  "this",
  "those",
  "earlier",
  "last",
  "time",
  "other",
  "old",
  "kya",
  "woh",
  "wo",
  "wala",
  "pehle",
  "bataya",
  "tha",
  "thi",
  "hai",
  "ho",
  "gaya",
  "and",
  "or",
  "to",
  "of",
  "me",
  "your",
  "did",
  "do",
  "what",
  "where",
  "when",
  "how",
  "also",
  "include",
  "us",
  "add",
  "karne",
  "bole",
  "bola",
  "kaha",
]);

export function looksLikePastReference(text: string) {
  return PAST_REF.test(text.trim());
}

export function referenceQuery(text: string) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));
  return words.slice(0, 8).join(" ");
}

type Mention = {
  role: string;
  content: string;
  created_at: string;
  conversation_id: string | null;
};

// Search lasting summaries and the last 30 days of raw lines.
export async function searchChatHistory(
  supabase: Supabase,
  query: string,
  currentConversationId?: string,
) {
  const q = query
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9\u0900-\u097F\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (q.length < 2) return { summaries: [], mentions: [] };
  const needle = q.toLowerCase();
  const [{ data: summaries }, { data: mentions }] = await Promise.all([
    supabase
      .from("ai_chat_summaries")
      .select("conversation_id, title, summary, updated_at")
      .or(`title.ilike.%${escapeIlike(q)}%,summary.ilike.%${escapeIlike(q)}%`)
      .order("updated_at", { ascending: false })
      .limit(8)
      .returns<ChatSummary[]>(),
    supabase
      .from("ai_messages")
      .select("role, content, created_at, conversation_id")
      .ilike("content", `%${escapeIlike(q)}%`)
      .gte(
        "created_at",
        new Date(Date.now() - MESSAGE_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Mention[]>(),
  ]);
  return {
    summaries: (summaries ?? [])
      .filter((s) => s.conversation_id !== currentConversationId)
      .map((s) => ({
        title: s.title,
        summary: s.summary.slice(0, 500),
        when: s.updated_at.slice(0, 10),
      })),
    mentions: (mentions ?? [])
      .filter((m) => m.content.toLowerCase().includes(needle))
      .slice(0, 12)
      .map((m) => ({
        who: m.role === "user" ? "you" : "assistant",
        from: m.conversation_id === currentConversationId ? "this chat" : "earlier chat",
        text: m.content.slice(0, 400),
        when: String(m.created_at).slice(0, 10),
      })),
  };
}

// Drop this user's raw chat lines older than 30 days. Summaries stay.
export async function pruneOldMessages(supabase: Supabase) {
  const cutoff = new Date(Date.now() - MESSAGE_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("ai_messages").delete().lt("created_at", cutoff);
}

const Draft = z.object({
  summary: z.string().min(1).max(MAX_SUMMARY),
  facts: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        value: z.string().min(1).max(300),
      }),
    )
    .max(6),
});

// Refresh the lasting note for this chat, and save any new facts about the user.
export async function refreshChatSummary(
  supabase: Supabase,
  conversationId: string,
  knownLabels: string[],
) {
  const [{ data: conversation }, { data: rows }] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, title, summary")
      .eq("id", conversationId)
      .maybeSingle<{ id: string; title: string; summary: string | null }>(),
    supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(16),
  ]);
  if (!conversation) return;

  const recent = (rows ?? []).reverse();
  if (recent.filter((m) => m.role === "user").length < 1) return;

  const transcript = recent
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 600)}`)
    .join("\n");

  try {
    const { output } = await generateText({
      model: dataModel,
      instructions: `You write lasting notes about a person from their private assistant chat.
Return a short summary (who they are in this chat, what they decided, dates, exams, plans, what still matters) and any NEW lasting facts about them (family, work, likes, health, exam dates, long-term goals).
Do not invent. Skip passing moods, one-off tasks, and facts already listed.
Write the summary in plain English, 2–5 sentences, under 150 words. Lead with what THIS conversation is currently about, then any lasting facts or decisions.`,
      prompt: `Already known facts: ${knownLabels.join(", ") || "none"}
Previous summary: ${conversation.summary || "none"}

Latest turns:
${transcript}`,
      output: Output.object({ schema: Draft }),
      temperature: 0.2,
      maxOutputTokens: 500,
      abortSignal: AbortSignal.timeout(12000),
    });

    const summary = output.summary.trim().slice(0, MAX_SUMMARY);
    if (!summary) return;

    const title = (conversation.title || "Chat").slice(0, 120);
    const now = new Date().toISOString();
    const { data: live } = await supabase
      .from("ai_chat_summaries")
      .select("id")
      .eq("conversation_id", conversationId)
      .maybeSingle<{ id: string }>();

    await Promise.all([
      supabase.from("ai_conversations").update({ summary }).eq("id", conversationId),
      live
        ? supabase.from("ai_chat_summaries").update({ title, summary, updated_at: now }).eq("id", live.id)
        : supabase.from("ai_chat_summaries").insert({
            conversation_id: conversationId,
            title,
            summary,
          }),
    ]);

    const seen = new Set(knownLabels.map((k) => k.toLowerCase()));
    for (const fact of output.facts) {
      const label = fact.label.trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      await saveMemory(supabase, { label, value: fact.value.trim() });
    }
  } catch (error) {
    console.error("[assistant] chat summary failed:", error);
  }
}
