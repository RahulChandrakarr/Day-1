import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MediaSave, MediaSource, MediaStatus } from "./media";

const COLUMNS =
  "id, source, source_id, title, channel, url, thumb, status, created_at, updated_at";

export async function getSavedMedia(): Promise<MediaSave[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_saves")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .returns<MediaSave[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertMediaSave(row: {
  source: MediaSource;
  sourceId: string;
  title: string;
  channel?: string | null;
  url: string;
  thumb?: string | null;
  status?: MediaStatus;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) throw new Error("Not signed in.");
  const { data, error } = await supabase
    .from("media_saves")
    .upsert(
      {
        user_id: uid,
        source: row.source,
        source_id: row.sourceId.slice(0, 200),
        title: row.title.slice(0, 200),
        channel: row.channel?.slice(0, 120) || null,
        url: row.url.slice(0, 500),
        thumb: row.thumb?.slice(0, 500) || null,
        status: row.status ?? "saved",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source,source_id" },
    )
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteMediaSave(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("media_saves").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setMediaStatus(id: string, status: MediaStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("media_saves")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
