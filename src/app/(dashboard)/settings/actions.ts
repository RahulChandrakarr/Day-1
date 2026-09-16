"use server";

import { revalidatePath } from "next/cache";
import type { ReminderKind } from "@/lib/reminders";
import { clearSpendPin, refreshSpendPin } from "@/lib/push/today";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["briefing", "journal", "habits", "gym", "money", "spend_pin"];

export async function saveReminder(input: {
  kind: ReminderKind;
  enabled: boolean;
  hour: number;
  minute: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!KINDS.includes(input?.kind))
    return { ok: false, error: "Unknown reminder." };
  const hour = Number(input.hour);
  const minute = Number(input.minute);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23)
    return { ok: false, error: "Pick a valid time." };
  if (!Number.isInteger(minute) || minute < 0 || minute > 59)
    return { ok: false, error: "Pick a valid time." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("reminder_settings").upsert(
    {
      user_id: claims.claims.sub,
      kind: input.kind,
      enabled: Boolean(input.enabled),
      hour,
      minute,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  // Show or clear the pinned card right away
  if (input.kind === "spend_pin") {
    if (input.enabled) await refreshSpendPin();
    else await clearSpendPin();
  }
  return { ok: true };
}
