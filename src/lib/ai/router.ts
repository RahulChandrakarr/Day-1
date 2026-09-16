import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { SECTION_NAMES, type Section } from "./domains";
import { dataModel } from "./models";
import { routerInstructions } from "./prompts";

const Route = z.object({
  sections: z.array(z.enum(SECTION_NAMES)).min(1).max(4),
  customQuery: z.boolean(),
});

export type RouteDecision = { sections: Section[]; customQuery: boolean };

const FALLBACK: RouteDecision = {
  sections: ["daily", "plan", "health", "finance"],
  customQuery: false,
};

// Picks the section agents for a message. Falls back to the broad set on failure.
export async function routeMessage(
  history: ModelMessage[],
  text: string,
): Promise<RouteDecision> {
  const recent = history
    .slice(-4)
    .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 300) : ""}`)
    .join("\n");
  try {
    const { output } = await generateText({
      model: dataModel,
      instructions: routerInstructions(),
      prompt: `${recent ? `Recent conversation:\n${recent}\n\n` : ""}Latest message: ${text}`,
      output: Output.object({ schema: Route }),
      temperature: 0,
      maxOutputTokens: 200,
      abortSignal: AbortSignal.timeout(6000),
    });
    return { sections: [...new Set(output.sections)], customQuery: output.customQuery };
  } catch (error) {
    console.error("[assistant] router failed:", error);
    return FALLBACK;
  }
}
