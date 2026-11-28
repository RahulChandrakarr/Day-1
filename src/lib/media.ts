// Shared Watch-desk types. Safe for server and client.

export const MEDIA_SOURCES = ["youtube", "instagram"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export const MEDIA_STATUSES = ["saved", "watched"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export type YtVideo = {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  publishedAt: string | null;
  url: string;
};

export type IgPost = {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  thumb: string | null;
  permalink: string;
  timestamp: string | null;
};

export type MediaSave = {
  id: string;
  source: MediaSource;
  source_id: string;
  title: string;
  channel: string | null;
  url: string;
  thumb: string | null;
  status: MediaStatus;
  created_at: string;
  updated_at: string;
};

export function youtubeUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function parseYouTubeId(input: string) {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const m = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}
