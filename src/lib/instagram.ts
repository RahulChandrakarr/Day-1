import "server-only";
import type { IgPost } from "./media";

const API = "https://graph.instagram.com";

export type InstagramResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; keyRejected?: boolean };

export type InstagramSelf = { id: string; username: string };

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function call(path: string, token: string, params: Record<string, string> = {}) {
  const url = `${API}${path}?${new URLSearchParams({ ...params, access_token: token })}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { ok: false as const, error: "Couldn't reach Instagram. Try again in a moment." };
  }
  const body = asRecord(await response.json().catch(() => null));
  if (response.status === 190 || response.status === 401 || response.status === 403) {
    return {
      ok: false as const,
      keyRejected: true,
      error: "Instagram didn't accept that token. Generate a new one in the Meta app dashboard.",
    };
  }
  if (!response.ok) {
    const message = String(asRecord(body?.error)?.message ?? `Instagram returned ${response.status}.`);
    const rejected = /oauth|token|session|expired|invalid/i.test(message);
    return { ok: false as const, error: message.slice(0, 200), keyRejected: rejected };
  }
  return { ok: true as const, data: body ?? {} };
}

export async function getInstagramSelf(token: string): Promise<InstagramResult<InstagramSelf>> {
  const result = await call("/me", token, { fields: "user_id,username,id" });
  if (!result.ok) return result;
  const row = Array.isArray(result.data.data) ? asRecord(result.data.data[0]) : result.data;
  const username = String(row?.username ?? "").replace(/^@/, "").trim();
  const id = String(row?.user_id ?? row?.id ?? "").trim();
  if (!username || !id) return { ok: false, error: "Instagram didn't return this account." };
  return { ok: true, data: { id, username } };
}

export async function listInstagramMedia(
  token: string,
): Promise<InstagramResult<{ username: string; posts: IgPost[] }>> {
  const self = await getInstagramSelf(token);
  if (!self.ok) return self;
  const result = await call(`/${self.data.id}/media`, token, {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
    limit: "24",
  });
  if (!result.ok) return result;
  const items = Array.isArray(result.data.data) ? result.data.data : [];
  const posts: IgPost[] = [];
  for (const raw of items) {
    const row = asRecord(raw);
    if (!row?.id || !row.permalink) continue;
    const caption = String(row.caption ?? "").trim();
    posts.push({
      id: String(row.id).slice(0, 200),
      caption: caption.slice(0, 200) || "Instagram post",
      mediaType: String(row.media_type ?? "IMAGE"),
      mediaUrl: typeof row.media_url === "string" ? row.media_url : null,
      thumb:
        typeof row.thumbnail_url === "string"
          ? row.thumbnail_url
          : typeof row.media_url === "string"
            ? row.media_url
            : null,
      permalink: String(row.permalink).slice(0, 500),
      timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    });
  }
  return { ok: true, data: { username: self.data.username, posts } };
}
