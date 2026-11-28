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
    signal: AbortSignal.timeout(22_000),
    body: JSON.stringify({
      model: process.env.AI_DATA_MODEL ?? "anthropic/claude-haiku-4.5",
      temperature: 0,
      max_tokens: 1200,
      reasoning: { effort: "none" },
      tools: [
        {
          type: "openrouter:web_search",
          parameters: { max_results: 8, max_uses: 2, search_context_size: "medium" },
        },
      ],
      messages: [
        {
          role: "system",
          content:
            "Search the live web. Return a compact briefing: key facts, dates, names, numbers, and the most useful links (full https URLs). For jobs, list role, company, location, and apply URL. For news, say when it happened. No filler.",
        },
        { role: "user", content: query.slice(0, 400) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  const data = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 4000) : null;
}

// Facts from the public web: news, jobs, people, weather, sports, how-tos.
export async function searchWeb(query: string) {
  const q = query.trim().slice(0, 300);
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

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\]|.*\.local|.*\.internal)$/i;

function publicHttpUrl(raw: string) {
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https pages can be opened.");
  }
  if (PRIVATE_HOST.test(parsed.hostname)) {
    throw new Error("That address can't be opened.");
  }
  return parsed;
}

// Read a public web page (articles, job posts, docs) as plain text.
export async function fetchPage(url: string) {
  let parsed: URL;
  try {
    parsed = publicHttpUrl(url.trim());
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That doesn't look like a web address." };
  }
  try {
    const response = await fetch(`https://r.jina.ai/${parsed.toString()}`, {
      headers: { ...UA, Accept: "text/plain" },
      signal: AbortSignal.timeout(18_000),
    });
    if (!response.ok) return { error: `Couldn't open that page (${response.status}).` };
    const body = (await response.text()).replace(/[ \t]+\n/g, "\n").trim();
    if (!body) return { error: "That page came back empty." };
    return {
      url: parsed.toString(),
      text: body.slice(0, 12_000),
      truncated: body.length > 12_000,
    };
  } catch (error) {
    console.error("[assistant] page fetch failed:", error);
    return { error: "Couldn't open that page right now." };
  }
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
