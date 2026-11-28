import "server-only";
import type { ToolSet } from "ai";
import { getChatSummaries } from "@/lib/ai/chat-memory";
import { getMemories } from "@/lib/assistant-memory";
import { addDays, todayISO } from "@/lib/finance";
import { MOODS } from "@/lib/journal";
import { getJournalEntry } from "@/lib/journal-queries";
import { todayCard } from "../snapshot";
import type { Supabase } from "../types";
import { safe, type Domain, type ToolContext } from "./common";
import { daily } from "./daily";
import { documents } from "./documents";
import { finance, financeBriefingContext, financeSnapshot } from "./finance";
import { health } from "./health";
import { plan } from "./plan";
import { reports } from "./reports";
import { settings } from "./settings";
import { sharedLabels, sharedTools } from "./shared";
import { jobs } from "./jobs";
import { watch } from "./watch";
import { world } from "./world";

export const SECTIONS = {
  daily,
  plan,
  health,
  finance,
  documents,
  reports,
  settings,
  world,
  jobs,
  watch,
} satisfies Record<string, Domain>;

export type Section = keyof typeof SECTIONS;
export const SECTION_NAMES = Object.keys(SECTIONS) as [Section, ...Section[]];

// The section agent: tools and prompts of the chosen sections, plus shared ones.
export function buildAgent(ctx: ToolContext, sections: Section[], { sql }: { sql: boolean }) {
  const tools: ToolSet = { ...sharedTools(ctx, { sql }) };
  const labels: Record<string, string> = { ...sharedLabels };
  const prompts: string[] = [];
  for (const name of sections) {
    const domain = SECTIONS[name];
    Object.assign(tools, domain.tools(ctx));
    Object.assign(labels, domain.labels);
    prompts.push(domain.prompt);
  }
  return { tools: safe(tools), labels, prompts };
}

export { financeSnapshot };

// Everything the morning check-in talks about: today, how yesterday went, and money.
export async function buildBriefingContext(supabase: Supabase) {
  const today = todayISO();
  const [card, yesterday, finance, memories, chats] = await Promise.all([
    todayCard(today),
    getJournalEntry(addDays(today, -1)),
    financeBriefingContext(supabase),
    getMemories(supabase, 20).catch(() => []),
    getChatSummaries(supabase, 6).catch(() => []),
  ]);
  const { entry } = yesterday;
  return {
    today: card,
    yesterday: yesterday.exists
      ? {
          mood: MOODS.find((m) => m.value === entry.mood)?.label ?? null,
          notes: entry.notes.slice(0, 300),
          wins: entry.wins.slice(0, 200),
          plannedForToday: entry.tomorrow.slice(0, 300),
        }
      : { journalWritten: false },
    finance,
    known: memories.map(({ label, value }) => ({ label, value })),
    recentChats: chats.map(({ title, summary }) => ({
      title,
      summary: summary.slice(0, 400),
    })),
  };
}
