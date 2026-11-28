import "server-only";
import { parseYouTubeId, youtubeThumb, youtubeUrl, type YtVideo } from "./media";

const API = "https://www.googleapis.com/youtube/v3";

export type YoutubeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; keyRejected?: boolean };

export function youtubeEnvKey() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key && key.length >= 20 ? key : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function call(
  path: string,
  key: string,
  params: Record<string, string>,
  cache: RequestCache | undefined = undefined,
) {
  const url = `${API}${path}?${new URLSearchParams({ ...params, key })}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      ...(cache ? { cache } : { next: { revalidate: 600 } }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false as const, error: "Couldn't reach YouTube. Try again in a moment." };
  }
  const body = asRecord(await response.json().catch(() => null));
  if (response.status === 400 || response.status === 403) {
    return {
      ok: false as const,
      keyRejected: true,
      error: "YouTube didn't accept that API key. Create a Data API v3 key in Google Cloud.",
    };
  }
  if (!response.ok) {
    return { ok: false as const, error: `YouTube returned ${response.status}.` };
  }
  return { ok: true as const, data: body ?? {} };
}

function fromSearchItem(item: unknown): YtVideo | null {
  const row = asRecord(item);
  const id = asRecord(row?.id)?.videoId;
  const snip = asRecord(row?.snippet);
  if (typeof id !== "string" || !/^[\w-]{11}$/.test(id) || !snip) return null;
  const title = String(snip.title ?? "").trim();
  if (!title) return null;
  const thumbs = asRecord(snip.thumbnails);
  const thumb =
    String(asRecord(thumbs?.medium)?.url ?? asRecord(thumbs?.high)?.url ?? "") || youtubeThumb(id);
  return {
    id,
    title: title.slice(0, 200),
    channel: String(snip.channelTitle ?? "").slice(0, 120),
    thumb,
    publishedAt: typeof snip.publishedAt === "string" ? snip.publishedAt : null,
    url: youtubeUrl(id),
  };
}

function fromVideoItem(item: unknown): YtVideo | null {
  const row = asRecord(item);
  const id = typeof row?.id === "string" ? row.id : null;
  const snip = asRecord(row?.snippet);
  if (!id || !/^[\w-]{11}$/.test(id) || !snip) return null;
  const title = String(snip.title ?? "").trim();
  if (!title) return null;
  const thumbs = asRecord(snip.thumbnails);
  return {
    id,
    title: title.slice(0, 200),
    channel: String(snip.channelTitle ?? "").slice(0, 120),
    thumb: String(asRecord(thumbs?.medium)?.url ?? "") || youtubeThumb(id),
    publishedAt: typeof snip.publishedAt === "string" ? snip.publishedAt : null,
    url: youtubeUrl(id),
  };
}

export async function pingYoutube(key: string): Promise<YoutubeResult<{ ok: true }>> {
  const result = await call(
    "/videos",
    key,
    {
      part: "id",
      chart: "mostPopular",
      maxResults: "1",
      regionCode: "IN",
    },
    "no-store",
  );
  if (!result.ok) return result;
  return { ok: true, data: { ok: true } };
}

export async function searchYoutube(key: string, query: string): Promise<YoutubeResult<YtVideo[]>> {
  const q = query.trim().slice(0, 120);
  if (!q) return popularYoutube(key);
  const result = await call("/search", key, {
    part: "snippet",
    type: "video",
    maxResults: "12",
    q,
    regionCode: "IN",
    safeSearch: "moderate",
  });
  if (!result.ok) return result;
  const items = Array.isArray(result.data.items) ? result.data.items : [];
  return { ok: true, data: items.map(fromSearchItem).filter((v): v is YtVideo => Boolean(v)) };
}

export async function popularYoutube(key: string): Promise<YoutubeResult<YtVideo[]>> {
  const result = await call("/videos", key, {
    part: "snippet",
    chart: "mostPopular",
    maxResults: "12",
    regionCode: "IN",
  });
  if (!result.ok) return result;
  const items = Array.isArray(result.data.items) ? result.data.items : [];
  return { ok: true, data: items.map(fromVideoItem).filter((v): v is YtVideo => Boolean(v)) };
}

export async function youtubeOEmbed(idOrUrl: string): Promise<YtVideo | null> {
  const id = parseYouTubeId(idOrUrl);
  if (!id) return null;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?${new URLSearchParams({
        url: youtubeUrl(id),
        format: "json",
      })}`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } },
    );
    if (!response.ok) return { id, title: "YouTube video", channel: "", thumb: youtubeThumb(id), publishedAt: null, url: youtubeUrl(id) };
    const data = asRecord(await response.json());
    return {
      id,
      title: String(data?.title ?? "YouTube video").slice(0, 200),
      channel: String(data?.author_name ?? "").slice(0, 120),
      thumb: youtubeThumb(id),
      publishedAt: null,
      url: youtubeUrl(id),
    };
  } catch {
    return { id, title: "YouTube video", channel: "", thumb: youtubeThumb(id), publishedAt: null, url: youtubeUrl(id) };
  }
}
