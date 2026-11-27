"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { deleteIntegrationKey, saveIntegrationKey } from "@/lib/integrations/keys";
import { getSplitwiseUser } from "@/lib/splitwise";

export type ConnectState = { error: string | null };

function refresh() {
  revalidatePath("/settings/integrations");
  revalidatePath("/financial/borrow");
}

// Saves a pasted Splitwise API key, but only after Splitwise accepts it. The
// key never travels back to the browser.
export async function connectSplitwise(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const { profile } = await requireProfile();
  const key = String(formData.get("key") ?? "").trim();
  if (!/^[A-Za-z0-9._-]{20,200}$/.test(key))
    return { error: "That doesn't look like a Splitwise API key. Copy it again from Splitwise." };

  const user = await getSplitwiseUser(key);
  if (!user.ok) return { error: user.error };

  try {
    await saveIntegrationKey(profile.id, "splitwise", key, {
      name: user.data.name,
      id: String(user.data.id),
    });
  } catch {
    return { error: "Splitwise accepted the key, but it couldn't be saved. Try again." };
  }
  refresh();
  return { error: null };
}

export async function disconnectSplitwise(): Promise<ConnectState> {
  const { profile } = await requireProfile();
  try {
    await deleteIntegrationKey(profile.id, "splitwise");
  } catch {
    return { error: "Couldn't disconnect just now. Try again." };
  }
  refresh();
  return { error: null };
}
