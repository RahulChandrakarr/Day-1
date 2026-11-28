import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { z } from "zod";
import { SECTION_NAMES, type Section } from "./domains";
import { dataModel } from "./models";
import { routerInstructions } from "./prompts";

const FOLLOW_UP =
  /^(yes|yeah|yep|yup|ok|okay|sure|no|nope|nah|haan|ha|haji|nahi|na|hmm|right|correct|done|go ahead|please|thanks|thank you)[.!?]*$/i;
const FOLLOW_UP_VALUE =
  /^[₹$]?\s*\d[\d,]*(?:\.\d+)?\s*(rs|inr|rupees?|kg|kgs|reps?|sets?|mins?|minutes?|months?|days?)?\.?$/i;
const FOLLOW_UP_PICK = /^(the )?(first|second|third|last|that|this|same)(\s+one)?[.!?]?$/i;

export function looksLikeFollowUp(text: string) {
  const t = text.trim();
  return FOLLOW_UP.test(t) || FOLLOW_UP_VALUE.test(t) || FOLLOW_UP_PICK.test(t);
}

function stickySections(previous: Section[] | undefined, allowed: Section[]) {
  return (previous ?? []).filter((s) => allowed.includes(s));
}

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
const PLANISH =
  /परीक्षा|नोट|प्लान|\b(exam|exams|syllabus|notes?|study plan|revision|flashcards?|study prompt|make (a |the )?plan|create (a |the )?plan|add (a |the )?plan|write (a |the )?note|save (a |the )?note|generate (a |the )?(note|notes|plan|prompt))\b/i;
const TABLEISH =
  /तालिका|टेबल|(?:\b(?:make|generate|create|build|show|give|draw|put)\b.{0,48}\b(?:table|spreadsheet)\b)|(?:\b(?:table|spreadsheet)\s+of\b)|(?:\b(?:in|as)\s+a\s+table\b)/i;

export function looksLikePlan(text: string) {
  return PLANISH.test(text.trim());
}

export function looksLikeTable(text: string) {
  return TABLEISH.test(text.trim());
}

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
  previous?: Section[],
): Promise<RouteDecision> {
  const sticky = stickySections(previous, allowed);
  if (looksLikeFollowUp(text) && sticky.length) {
    return { sections: sticky, customQuery: false, detail: "brief" };
  }
  const world: Section[] = allowed.includes("world") ? ["world"] : [];
  const jobs: Section[] = allowed.includes("jobs") ? ["jobs"] : [];
  const watch: Section[] = allowed.includes("watch") ? ["watch"] : [];
  const plan: Section[] = allowed.includes("plan") ? ["plan"] : [];
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
    sections: looksLikePlan(text) && plan.length
      ? plan
      : looksLikeWatch(text) && watch.length
      ? watch
      : looksLikeJobs(text) && jobs.length
      ? jobs
      : looksLikeWorld(text) && world.length
      ? world
      : sticky.length
        ? sticky
        : allowed.length <= 4
          ? allowed
          : BROAD.filter((s) => allowed.includes(s)),
    customQuery: false,
    detail:
      looksLikeWorld(text) ||
      looksLikeJobs(text) ||
      looksLikeWatch(text) ||
      looksLikePlan(text) ||
      looksLikeTable(text)
        ? "full"
        : "brief",
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
    .slice(-6)
    .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content.slice(0, 400) : ""}`)
    .join("\n");
  try {
    const { output } = await generateText({
      model: dataModel,
      instructions: routerInstructions(allowed, sticky),
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
    if (looksLikePlan(text) && plan.length && !sections.includes("plan")) {
      sections.push("plan");
    }
    if (WORLDISH.test(text.trim()) && world.length && !sections.includes("world")) {
      sections.push("world");
    }
    return {
      sections,
      customQuery: output.customQuery,
      detail: looksLikeSong(text) || looksLikePlan(text) || looksLikeTable(text) ? "full" : output.detail,
    };
  } catch (error) {
    console.error("[assistant] router failed:", error);
    return fallback;
  }
}
