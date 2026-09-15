import { createTextStreamResponse, streamText } from "ai";
import { buildBriefingContext } from "@/lib/ai/domains";
import { answerModel, answerProviderOptions } from "@/lib/ai/models";
import { briefingInstructions } from "@/lib/ai/prompts";
import { firstName, getApiSession, jsonError } from "@/lib/ai/session";
import { todayISO } from "@/lib/finance";

export const maxDuration = 60;

const MAX_REFRESHES_PER_DAY = 5;

export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);
  const { supabase, profile } = session;

  const body = (await req.json().catch(() => ({}))) as { refresh?: boolean };
  const forDate = todayISO();

  const { data: existing } = await supabase
    .from("ai_briefings")
    .select("content, refresh_count")
    .eq("for_date", forDate)
    .maybeSingle();

  if (existing && !body.refresh) {
    return new Response(existing.content, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-briefing-cached": "1",
      },
    });
  }
  if (existing && existing.refresh_count >= MAX_REFRESHES_PER_DAY) {
    return jsonError("Briefing refresh limit reached for today.", 429);
  }

  const context = await buildBriefingContext(supabase);
  const result = streamText({
    model: answerModel,
    instructions: briefingInstructions(firstName(profile)),
    prompt: `<data>${JSON.stringify(context)}</data>\n\nWrite today's briefing.`,
    temperature: 0.4,
    maxOutputTokens: 700,
    providerOptions: answerProviderOptions,
    onEnd: async ({ text }) => {
      if (!text.trim()) return;
      await supabase.from("ai_briefings").upsert(
        {
          user_id: profile.id,
          for_date: forDate,
          content: text.slice(0, 20000),
          refresh_count: existing ? existing.refresh_count + 1 : 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,for_date" },
      );
    },
  });
  result.consumeStream();

  return createTextStreamResponse({ stream: result.textStream });
}
