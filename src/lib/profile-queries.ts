import "server-only";
import { cache } from "react";
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

// Short-lived link to the private profile photo.
export const getAvatarUrl = cache(async (path: string | null) => {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
});

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
