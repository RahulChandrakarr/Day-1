"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isBackgroundChoice, type BackgroundChoice } from "@/lib/backgrounds";

type Result = { ok: true } | { ok: false; error: string };

// Every page shows the background, so the whole app redraws with the new one
const refresh = () => revalidatePath("/", "layout");

// Picks a built-in background, or their already-uploaded photo again. Their
// photo is kept either way, so it can be picked again later.
export async function chooseBackground(choice: BackgroundChoice): Promise<Result> {
  const { supabase, profile } = await requireProfile();
  if (!isBackgroundChoice(choice)) return { ok: false, error: "Unknown background." };
  if (choice === "upload" && !profile.background_path)
    return { ok: false, error: "Upload a photo first." };

  const { error } = await supabase.rpc("set_my_background", {
    p_background: choice,
    p_path: profile.background_path,
  });
  if (error) return { ok: false, error: "Couldn't change the background. Try again." };
  refresh();
  return { ok: true };
}

// After the browser has uploaded a new photo: show it, and delete the one it replaces
export async function applyUploadedBackground(path: string): Promise<Result> {
  const { supabase, profile } = await requireProfile();
  if (!path.startsWith(`${profile.id}/`)) return { ok: false, error: "Invalid photo." };

  const { error } = await supabase.rpc("set_my_background", {
    p_background: "upload",
    p_path: path,
  });
  if (error) return { ok: false, error: "The photo uploaded, but couldn't be set. Try again." };
  if (profile.background_path && profile.background_path !== path)
    await supabase.storage.from("backgrounds").remove([profile.background_path]);
  refresh();
  return { ok: true };
}

// Forgets their photo; if it was showing, the sky comes back
export async function removeBackgroundPhoto(): Promise<Result> {
  const { supabase, profile } = await requireProfile();
  const { error } = await supabase.rpc("set_my_background", {
    p_background: profile.background === "upload" ? "sky" : profile.background,
    p_path: null,
  });
  if (error) return { ok: false, error: "Couldn't remove the photo. Try again." };
  if (profile.background_path)
    await supabase.storage.from("backgrounds").remove([profile.background_path]);
  refresh();
  return { ok: true };
}
