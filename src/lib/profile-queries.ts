import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  name: string;
  folder: string;
  path: string;
  mime: string;
  size: number;
  created_at: string;
};

// Where the browser fetches the profile photo from: /api/media, which checks
// who is asking. The address only changes when the photo does, so the device
// keeps its copy instead of downloading the photo again on every visit.
export const avatarUrl = (path: string | null) => mediaUrl("avatars", path);

// The same, for their own background photo (Settings -> Appearance)
export const backgroundUrl = (path: string | null) => mediaUrl("backgrounds", path);

function mediaUrl(bucket: "avatars" | "backgrounds", path: string | null) {
  return path ? `/api/media/${bucket}?p=${encodeURIComponent(path)}` : null;
}

export async function getDocuments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, folder, path, mime, size, created_at")
    .order("created_at", { ascending: false })
    .returns<DocumentRow[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({ ...d, size: Number(d.size) }));
}
