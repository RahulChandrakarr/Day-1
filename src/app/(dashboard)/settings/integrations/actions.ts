"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { getFreelancerSelf } from "@/lib/freelancer";
import { getInstagramSelf } from "@/lib/instagram";
import { deleteIntegrationKey, saveIntegrationKey } from "@/lib/integrations/keys";
import { getSplitwiseUser } from "@/lib/splitwise";
import { getUpworkSelf } from "@/lib/upwork";
import { pingYoutube } from "@/lib/youtube";

export type ConnectState = { error: string | null };

function refresh() {
  revalidatePath("/settings/integrations");
  revalidatePath("/financial/borrow");
  revalidatePath("/jobs");
  revalidatePath("/watch");
}

function pastedToken(formData: FormData) {
  return String(formData.get("key") ?? "").trim();
}

function tokenLooksWrong(key: string, max = 2000) {
  return key.length < 20 || key.length > max || /\s/.test(key);
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

export async function connectFreelancer(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const { profile } = await requireProfile();
  const key = pastedToken(formData);
  if (tokenLooksWrong(key))
    return { error: "That doesn't look like a Freelancer token. Copy it again from their developer portal." };

  const user = await getFreelancerSelf(key);
  if (!user.ok) return { error: user.error };

  try {
    await saveIntegrationKey(profile.id, "freelancer", key, {
      name: user.data.name,
      id: String(user.data.id),
    });
  } catch {
    return { error: "Freelancer accepted the token, but it couldn't be saved. Try again." };
  }
  refresh();
  return { error: null };
}

export async function disconnectFreelancer(): Promise<ConnectState> {
  const { profile } = await requireProfile();
  try {
    await deleteIntegrationKey(profile.id, "freelancer");
  } catch {
    return { error: "Couldn't disconnect just now. Try again." };
  }
  refresh();
  return { error: null };
}

export async function connectUpwork(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const { profile } = await requireProfile();
  const key = pastedToken(formData);
  if (tokenLooksWrong(key))
    return { error: "That doesn't look like an Upwork token. Copy it again from your API app." };

  const user = await getUpworkSelf(key);
  if (!user.ok) return { error: user.error };

  try {
    await saveIntegrationKey(profile.id, "upwork", key, {
      name: user.data.name,
      id: null,
    });
  } catch {
    return { error: "Upwork accepted the token, but it couldn't be saved. Try again." };
  }
  refresh();
  return { error: null };
}

export async function disconnectUpwork(): Promise<ConnectState> {
  const { profile } = await requireProfile();
  try {
    await deleteIntegrationKey(profile.id, "upwork");
  } catch {
    return { error: "Couldn't disconnect just now. Try again." };
  }
  refresh();
  return { error: null };
}

export async function connectYoutube(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const { profile } = await requireProfile();
  const key = pastedToken(formData);
  if (tokenLooksWrong(key, 200))
    return { error: "That doesn't look like a YouTube Data API key. Copy it again from Google Cloud." };

  const ping = await pingYoutube(key);
  if (!ping.ok) return { error: ping.error };

  try {
    await saveIntegrationKey(profile.id, "youtube", key, { name: "YouTube Data API", id: null });
  } catch {
    return { error: "YouTube accepted the key, but it couldn't be saved. Try again." };
  }
  refresh();
  return { error: null };
}

export async function disconnectYoutube(): Promise<ConnectState> {
  const { profile } = await requireProfile();
  try {
    await deleteIntegrationKey(profile.id, "youtube");
  } catch {
    return { error: "Couldn't disconnect just now. Try again." };
  }
  refresh();
  return { error: null };
}

export async function connectInstagram(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const { profile } = await requireProfile();
  const key = pastedToken(formData);
  if (tokenLooksWrong(key))
    return { error: "That doesn't look like an Instagram token. Copy it again from the Meta app dashboard." };

  const user = await getInstagramSelf(key);
  if (!user.ok) return { error: user.error };

  try {
    await saveIntegrationKey(profile.id, "instagram", key, {
      name: `@${user.data.username}`,
      id: user.data.id.slice(0, 64),
    });
  } catch {
    return { error: "Instagram accepted the token, but it couldn't be saved. Try again." };
  }
  refresh();
  return { error: null };
}

export async function disconnectInstagram(): Promise<ConnectState> {
  const { profile } = await requireProfile();
  try {
    await deleteIntegrationKey(profile.id, "instagram");
  } catch {
    return { error: "Couldn't disconnect just now. Try again." };
  }
  refresh();
  return { error: null };
}
