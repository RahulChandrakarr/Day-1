import "server-only";
import type { ToolSet } from "ai";
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

export const SECTIONS = {
  daily,
  plan,
  health,
  finance,
  documents,
  reports,
  settings,
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

export async function buildBriefingContext(supabase: Supabase) {
  const [finance] = await Promise.all([financeBriefingContext(supabase)]);
  return { finance };
}
