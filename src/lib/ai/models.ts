import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: { "X-Title": "Day One" },
});

// Fast, cheap model that only decides which data to fetch.
export const dataModel = openrouter(
  process.env.AI_DATA_MODEL ?? "anthropic/claude-haiku-4.5",
);

// Stronger model that writes the answer the user reads.
export const answerModel = openrouter(
  process.env.AI_ANSWER_MODEL ?? "anthropic/claude-sonnet-5",
);

// No hidden reasoning: answers start streaming immediately.
export const answerProviderOptions = {
  openrouter: { reasoning: { effort: "none" as const } },
};
