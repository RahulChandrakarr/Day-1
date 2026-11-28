import "server-only";

const UA = { "User-Agent": "DayOne/1.0 (personal assistant)" };
const DEVANAGARI = /[ऀ-ॿ]/;

async function readJson(response: Response) {
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<unknown>;
}

async function wikipedia(query: string) {
  const lang = DEVANAGARI.test(query) ? "hi" : "en";
  const found = await readJson(
    await fetch(
      `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: "3",
        format: "json",
        origin: "*",
      })}`,
      { headers: UA, signal: AbortSignal.timeout(8000) },
    ),
  );
  const hits =
    (found as { query?: { search?: { title: string }[] } }).query?.search ?? [];
  const title = hits[0]?.title;
  if (!title) return null;
  const page = await readJson(
    await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: UA, signal: AbortSignal.timeout(8000) },
    ),
  );
  const summary = page as { title?: string; extract?: string; description?: string };
  const extract = summary.extract?.trim();
  if (!extract) return null;
  return {
    title: summary.title ?? title,
    extract: extract.slice(0, 1200),
    also: hits.slice(1).map((h) => h.title),
  };
}

async function openRouterSearch(query: string) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Day One",
    },
    signal: AbortSignal.timeout(18_000),
    body: JSON.stringify({
      model: process.env.AI_DATA_MODEL ?? "anthropic/claude-haiku-4.5",
      temperature: 0,
      max_tokens: 700,
      reasoning: { effort: "none" },
      tools: [
        {
          type: "openrouter:web_search",
          parameters: { max_results: 5, max_uses: 1, search_context_size: "low" },
        },
      ],
      messages: [
        {
          role: "system",
          content:
            "Search the web and return a compact factual briefing: 4–8 short facts, with dates when known. No intro, no headings, no links.",
        },
        { role: "user", content: query.slice(0, 300) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 2500) : null;
}

// Facts from the public web. Used for news, people, weather, sports, how-tos.
export async function searchWeb(query: string) {
  const q = query.trim().slice(0, 200);
  if (!q) return { error: "What should I look up?" };
  try {
    const brief = await openRouterSearch(q);
    if (brief) return { query: q, brief };
  } catch (error) {
    console.error("[assistant] web search failed:", error);
  }
  try {
    const wiki = await wikipedia(q);
    if (wiki) return { query: q, source: "wikipedia", ...wiki };
  } catch (error) {
    console.error("[assistant] wikipedia failed:", error);
  }
  return { error: "Couldn't look that up right now. Try again in a moment." };
}

function verse(lyrics: string) {
  const lines = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[.*\]$/.test(line));
  // A chorus plus a verse is enough to sing; the full song is too long to speak.
  return lines.slice(0, 16).join("\n");
}

// Words of a song, for singing aloud. Not the original recording.
export async function lookupLyrics(query: string) {
  const q = query.trim().slice(0, 120);
  if (!q) return { error: "Which song?" };
  try {
    const rows = (await readJson(
      await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
        headers: UA,
        signal: AbortSignal.timeout(8000),
      }),
    )) as {
      trackName?: string;
      artistName?: string;
      plainLyrics?: string | null;
    }[];
    const hit = (rows ?? []).find((row) => row.plainLyrics?.trim());
    if (!hit?.plainLyrics) return { error: `No lyrics found for "${q}".` };
    return {
      title: hit.trackName ?? q,
      artist: hit.artistName ?? "",
      lyrics: verse(hit.plainLyrics),
    };
  } catch (error) {
    console.error("[assistant] lyrics lookup failed:", error);
    return { error: "Couldn't find those lyrics right now." };
  }
}
