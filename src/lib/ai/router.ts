import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { SECTION_NAMES, type Section } from "./domains";
import { dataModel } from "./models";
import { routerInstructions } from "./prompts";

// detail: "brief" for a fact or an action, "full" for analysis and reports
export type RouteDecision = {
  sections: Section[];
  customQuery: boolean;
  detail: "brief" | "full";
};

const BROAD: Section[] = ["daily", "plan", "health", "finance"];

const SONG =
  /गाना|सुनाओ|गीत|गाओ|लिरिक्स|\b(sing|song|gana|gaana|lyrics|spotify)\b/i;
const WORLDISH =
  /गाना|सुनाओ|गीत|गाओ|लिरिक्स|मौसम|खबर|\b(sing|song|gana|gaana|lyrics|spotify|news|weather|wikipedia|who won|score)\b/i;

export function looksLikeSong(text: string) {
  return SONG.test(text.trim());
}

export function looksLikeWorld(text: string) {
  return WORLDISH.test(text.trim());
}

// Picks the section agents for a message, only from the allowed ones.
// Falls back to a broad set on failure.
export async function routeMessage(
  history: ModelMessage[],
  text: string,
  allowed: Section[] = SECTION_NAMES,
): Promise<RouteDecision> {
  const world: Section[] = allowed.includes("world") ? ["world"] : [];
  if (looksLikeSong(text) && world.length) {
    return { sections: world, customQuery: false, detail: "full" };
  }
  const fallback: RouteDecision = {
    sections: looksLikeWorld(text) && world.length
      ? world
      : allowed.length <= 4
        ? allowed
        : BROAD.filter((s) => allowed.includes(s)),
    customQuery: false,
    detail: looksLikeWorld(text) ? "full" : "brief",
  };
  const Route = z.object({
    sections: z
      .array(z.enum(allowed as [Section, ...Section[]]))
      .min(1)
      .max(4),
    customQuery: z.boolean(),
    detail: z.enum(["brief", "full"]),
  });
  const recent = history
    .slice(-4)
    .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 300) : ""}`)
    .join("\n");
  try {
    const { output } = await generateText({
      model: dataModel,
      instructions: routerInstructions(allowed),
      prompt: `${recent ? `Recent conversation:\n${recent}\n\n` : ""}Latest message: ${text}`,
      output: Output.object({ schema: Route }),
      temperature: 0,
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(6000),
    });
    const sections = [...new Set(output.sections)];
    if (looksLikeSong(text) && world.length) {
      return { sections: world, customQuery: false, detail: "full" };
    }
    if (looksLikeWorld(text) && world.length && !sections.includes("world")) {
      sections.push("world");
    }
    return {
      sections,
      customQuery: output.customQuery,
      detail: looksLikeSong(text) ? "full" : output.detail,
    };
  } catch (error) {
    console.error("[assistant] router failed:", error);
    return fallback;
  }
}
