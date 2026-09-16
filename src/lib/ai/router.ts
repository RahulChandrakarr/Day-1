import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { SECTION_NAMES, type Section } from "./domains";
import { dataModel } from "./models";
import { routerInstructions } from "./prompts";

export type RouteDecision = { sections: Section[]; customQuery: boolean };

const BROAD: Section[] = ["daily", "plan", "health", "finance"];

// Picks the section agents for a message, only from the allowed ones.
// Falls back to a broad set on failure.
export async function routeMessage(
  history: ModelMessage[],
  text: string,
  allowed: Section[] = SECTION_NAMES,
): Promise<RouteDecision> {
  const fallback: RouteDecision = {
    sections: allowed.length <= 4 ? allowed : BROAD.filter((s) => allowed.includes(s)),
    customQuery: false,
  };
  const Route = z.object({
    sections: z
      .array(z.enum(allowed as [Section, ...Section[]]))
      .min(1)
      .max(4),
    customQuery: z.boolean(),
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
    return { sections: [...new Set(output.sections)], customQuery: output.customQuery };
  } catch (error) {
    console.error("[assistant] router failed:", error);
    return fallback;
  }
}
