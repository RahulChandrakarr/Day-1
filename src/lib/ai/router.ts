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
  /गाना|सुनाओ|गीत|गाओ|लिरिक्स|\b(sing|songs?|gana|gaana|lyrics|spotify|rap)\b/i;
const JOBISH =
  /\b(job|jobs|gig|gigs|hiring|vacancy|vacancies|freelance|freelancer|upwork|fiverr|naukri|adzuna)\b/i;
const WATCHISH =
  /\b(youtube|youtu\.be|instagram|insta|reels?)\b/i;
const WORLDISH =
  /गाना|सुनाओ|गीत|गाओ|लिरिक्स|मौसम|खबर|https?:\/\/|www\.|\b(sing|songs?|gana|gaana|lyrics|spotify|rap|news|weather|wikipedia|who won|score|article|research|crawl|website|url)\b/i;

export function looksLikeSong(text: string) {
  return SONG.test(text.trim());
}

export function looksLikeWorld(text: string) {
  return WORLDISH.test(text.trim()) || looksLikeJobs(text);
}

export function looksLikeJobs(text: string) {
  return JOBISH.test(text.trim());
}

export function looksLikeWatch(text: string) {
  return WATCHISH.test(text.trim());
}

// Picks the section agents for a message, only from the allowed ones.
// Falls back to a broad set on failure.
export async function routeMessage(
  history: ModelMessage[],
  text: string,
  allowed: Section[] = SECTION_NAMES,
): Promise<RouteDecision> {
  const world: Section[] = allowed.includes("world") ? ["world"] : [];
  const jobs: Section[] = allowed.includes("jobs") ? ["jobs"] : [];
  const watch: Section[] = allowed.includes("watch") ? ["watch"] : [];
  if (looksLikeSong(text) && world.length && !looksLikeWatch(text)) {
    return { sections: world, customQuery: false, detail: "full" };
  }
  if (looksLikeWatch(text) && watch.length) {
    const extra = looksLikeSong(text) ? world : [];
    return { sections: [...watch, ...extra], customQuery: false, detail: "full" };
  }
  if (looksLikeJobs(text) && jobs.length) {
    const extra = WORLDISH.test(text.trim()) ? world : [];
    return { sections: [...jobs, ...extra], customQuery: false, detail: "full" };
  }
  const fallback: RouteDecision = {
    sections: looksLikeWatch(text) && watch.length
      ? watch
      : looksLikeJobs(text) && jobs.length
      ? jobs
      : looksLikeWorld(text) && world.length
      ? world
      : allowed.length <= 4
        ? allowed
        : BROAD.filter((s) => allowed.includes(s)),
    customQuery: false,
    detail: looksLikeWorld(text) || looksLikeJobs(text) || looksLikeWatch(text) ? "full" : "brief",
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
    if (looksLikeSong(text) && world.length && !looksLikeWatch(text)) {
      return { sections: world, customQuery: false, detail: "full" };
    }
    if (looksLikeWatch(text) && watch.length && !sections.includes("watch")) {
      sections.push("watch");
    }
    if (looksLikeJobs(text) && jobs.length && !sections.includes("jobs")) {
      sections.push("jobs");
    }
    if (WORLDISH.test(text.trim()) && world.length && !sections.includes("world")) {
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
