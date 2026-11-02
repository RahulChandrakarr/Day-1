import { z } from "zod";
import { getApiSession, jsonError } from "@/lib/ai/session";
import { synthesize } from "@/lib/ai/voice";

export const maxDuration = 30;

const Body = z.object({ text: z.string().trim().min(1).max(1200) });

// Reads one sentence or short passage aloud, as MP3.
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  try {
    return new Response(await synthesize(parsed.data.text), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[voice] speak route failed:", error);
    return jsonError("The voice service isn't available", 502);
  }
}
