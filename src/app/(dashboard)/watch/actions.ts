"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { MEDIA_SOURCES, type MediaSource, type MediaStatus } from "@/lib/media";
import { deleteMediaSave, setMediaStatus, upsertMediaSave } from "@/lib/media-queries";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/watch");
}

export async function saveMedia(input: {
  source: MediaSource;
  sourceId: string;
  title: string;
  channel?: string | null;
  url: string;
  thumb?: string | null;
}): Promise<Result> {
  await requireProfile();
  if (!MEDIA_SOURCES.includes(input.source)) return { ok: false, error: "Unknown source." };
  const title = input.title.trim();
  const url = input.url.trim();
  const sourceId = input.sourceId.trim();
  if (!title || !sourceId || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: "That couldn't be saved." };
  }
  try {
    await upsertMediaSave({
      source: input.source,
      sourceId,
      title,
      channel: input.channel,
      url,
      thumb: input.thumb,
    });
  } catch {
    return { ok: false, error: "Couldn't save that just now. Try again." };
  }
  refresh();
  return { ok: true };
}

export async function markMedia(id: string, status: MediaStatus): Promise<Result> {
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown item." };
  try {
    await setMediaStatus(id, status);
  } catch {
    return { ok: false, error: "Couldn't update that just now." };
  }
  refresh();
  return { ok: true };
}

export async function forgetMedia(id: string): Promise<Result> {
  await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Unknown item." };
  try {
    await deleteMediaSave(id);
  } catch {
    return { ok: false, error: "Couldn't remove that just now." };
  }
  refresh();
  return { ok: true };
}
