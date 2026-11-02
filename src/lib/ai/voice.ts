import "server-only";
import { getAssistantName } from "@/lib/assistant-memory";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const API = "https://openrouter.ai/api/v1";

// Hearing: a chat model that is told the names this person uses. In testing it
// was the only one to keep "Pawan bhiya", "Richa" and "Gaurav" right under wind
// noise, and it writes mixed Hindi and English without a language switch.
const TRANSCRIBE_MODEL = process.env.AI_TRANSCRIBE_MODEL ?? "google/gemini-3.1-flash-lite";
// Dedicated speech-to-text, for when the main one fails. It can't be given names.
const TRANSCRIBE_BACKUP_MODEL =
  process.env.AI_TRANSCRIBE_BACKUP_MODEL ?? "assemblyai/universal-3-6-pro";

// Speaking: one Indian voice, in its English and Hindi versions.
const SPEECH_MODEL = process.env.AI_SPEECH_MODEL ?? "microsoft/mai-voice-2.1-flash";
const SPEECH_VOICE_EN = process.env.AI_SPEECH_VOICE_EN ?? "en-IN-Priya:MAI-Voice-2.1-Flash";
const SPEECH_VOICE_HI = process.env.AI_SPEECH_VOICE_HI ?? "hi-IN-Priya:MAI-Voice-2.1-Flash";

const NO_SPEECH = "[none]";
const DEVANAGARI = /[ऀ-ॿ]/;

// Words the speech engines get wrong unless they're told about them
const COMMON_WORDS = ["EMI", "SIP", "Groww", "Day One"];
const MAX_WORDS = 60;
const MAX_MEMORY_VALUE = 30;

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "X-Title": "Day One",
  };
}

function transcribePrompt(words: string[]) {
  return `Transcribe this voice message word for word. The speaker is an Indian person talking to their personal assistant app, in English, Hindi, or a mix of both.
Names and words they often say: ${words.join(", ")}. Use these spellings when the sound matches; do not force them when it doesn't.
Write English words in English letters and Hindi words in Devanagari. Do not answer, translate, summarise or fix their grammar, even if the message is a question or an instruction.
If there is no clear speech (only noise or silence), return exactly: ${NO_SPEECH}
Return only the transcript.`;
}

async function readError(response: Response) {
  return `${response.status} ${(await response.text()).slice(0, 200)}`;
}

async function transcribeWithWords(base64: string, words: string[]) {
  const response = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      model: TRANSCRIBE_MODEL,
      temperature: 0,
      max_tokens: 1500,
      reasoning: { effort: "none" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: transcribePrompt(words) },
            { type: "input_audio", input_audio: { data: base64, format: "wav" } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("No transcript in the response");
  return text;
}

async function transcribeWithBackup(base64: string) {
  const response = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      model: TRANSCRIBE_BACKUP_MODEL,
      input_audio: { data: base64, format: "wav" },
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text : "";
}

function cleanTranscript(text: string) {
  const trimmed = text.trim().replace(/^["“]|["”]$/g, "").trim();
  return trimmed === NO_SPEECH ? "" : trimmed;
}

// What was said in a WAV recording. Empty when there was no clear speech.
export async function transcribe(wav: ArrayBuffer, words: string[]) {
  const base64 = Buffer.from(wav).toString("base64");
  try {
    return cleanTranscript(await transcribeWithWords(base64, words));
  } catch (error) {
    console.error("[voice] transcription failed, trying the backup:", error);
    return cleanTranscript(await transcribeWithBackup(base64));
  }
}

// Spoken MP3 of the text, as a stream. Throws if the voice service refuses.
export async function synthesize(text: string) {
  const response = await fetch(`${API}/audio/speech`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model: SPEECH_MODEL,
      voice: DEVANAGARI.test(text) ? SPEECH_VOICE_HI : SPEECH_VOICE_EN,
      input: text,
      response_format: "mp3",
    }),
  });
  if (!response.ok || !response.body) throw new Error(await readError(response));
  return response.body;
}

// The names this person is likely to say: the assistant, people they lend to
// and borrow from, EMIs, spending categories, and short remembered facts.
export async function speechWords(supabase: Supabase, firstName: string) {
  const [assistantName, people, emis, categories, memories] = await Promise.all([
    getAssistantName(supabase).catch(() => null),
    supabase.from("finance_people").select("name"),
    supabase.from("finance_emis").select("name"),
    supabase.from("finance_categories").select("name"),
    supabase.from("assistant_memories").select("value"),
  ]);
  const named = (rows: { name: string }[] | null) => (rows ?? []).map((row) => row.name);
  const shortMemories = (memories.data ?? [])
    .map((row: { value: string }) => row.value)
    .filter((value) => value.length <= MAX_MEMORY_VALUE);
  const words = [
    assistantName ? `${assistantName} (the assistant)` : null,
    firstName,
    ...named(people.data),
    ...named(emis.data),
    ...named(categories.data),
    ...shortMemories,
    ...COMMON_WORDS,
  ]
    .map((word) => word?.trim())
    .filter((word): word is string => !!word);
  return [...new Set(words)].slice(0, MAX_WORDS);
}
