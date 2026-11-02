import { firstName, getApiSession, jsonError } from "@/lib/ai/session";
import { speechWords, transcribe } from "@/lib/ai/voice";

export const maxDuration = 30;

// Under the hosting limit of 4.5 MB: a little over two minutes of 16 kHz speech
const MAX_BYTES = 4 * 1024 * 1024;

// Turns one recording (a WAV file as the request body) into text.
export async function POST(req: Request) {
  const session = await getApiSession();
  if (!session) return jsonError("Not signed in", 401);

  if (!req.headers.get("content-type")?.startsWith("audio/wav"))
    return jsonError("Send a WAV recording", 415);

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) return jsonError("The recording is empty", 400);
  if (audio.byteLength > MAX_BYTES) return jsonError("The recording is too long", 413);

  try {
    const words = await speechWords(session.supabase, firstName(session.profile));
    return Response.json({ text: await transcribe(audio, words) });
  } catch (error) {
    console.error("[voice] transcribe route failed:", error);
    return jsonError("Couldn't make out what you said", 502);
  }
}
