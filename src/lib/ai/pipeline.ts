import "server-only";
import { generateText, hasToolCall, isStepCount, type ModelMessage } from "ai";
import type { Profile } from "@/lib/auth";
import { buildTools } from "./domains";
import { compact, STATUS_LABELS } from "./evidence";
import { dataModel } from "./models";
import { dataInstructions } from "./prompts";
import type { Evidence, Supabase } from "./types";

const DATA_AGENT_TIMEOUT_MS = 12_000;

// Stage 1: the data agent picks tools; their compacted results become evidence.
export async function runDataAgent({
  supabase,
  profile,
  schema,
  snapshot,
  history,
  priorEvidence,
  userText,
  onStatus,
  signal,
}: {
  supabase: Supabase;
  profile: Profile;
  schema: string;
  snapshot: unknown;
  history: ModelMessage[];
  priorEvidence: unknown;
  userText: string;
  onStatus: (label: string) => void;
  signal?: AbortSignal;
}): Promise<{ evidence: Evidence[]; failed: boolean }> {
  const timeout = AbortSignal.timeout(DATA_AGENT_TIMEOUT_MS);
  const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const announced = new Set<string>();

  try {
    const result = await generateText({
      model: dataModel,
      instructions: dataInstructions(schema),
      messages: [
        // Short recent context so follow-ups like "and last month?" resolve
        ...history.slice(-6).map(shorten),
        {
          role: "user",
          content: `<snapshot>${JSON.stringify(snapshot)}</snapshot>\n<prior_evidence>${JSON.stringify(priorEvidence ?? null)}</prior_evidence>\n\nLatest message: ${userText}`,
        },
      ],
      tools: buildTools(supabase, profile),
      toolChoice: "required",
      temperature: 0,
      maxOutputTokens: 800,
      stopWhen: [hasToolCall("done"), isStepCount(3)],
      abortSignal,
      onToolExecutionStart: ({ toolCall }) => {
        const label = STATUS_LABELS[toolCall.toolName];
        if (label && !announced.has(label)) {
          announced.add(label);
          onStatus(label);
        }
      },
    });

    const evidence = result.steps
      .flatMap((step) => step.toolResults)
      .filter((r) => r.toolName !== "done")
      .map((r) => compact(r.toolName, r.input, r.output));
    return { evidence, failed: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("[assistant] data agent failed:", error);
    return { evidence: [], failed: true };
  }
}

function shorten(message: ModelMessage): ModelMessage {
  if (typeof message.content !== "string") return message;
  const content =
    message.content.length > 500
      ? `${message.content.slice(0, 500)}…`
      : message.content;
  return { ...message, content } as ModelMessage;
}
