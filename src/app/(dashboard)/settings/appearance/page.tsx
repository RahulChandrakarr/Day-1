import type { Metadata } from "next";
import AppearanceSettings from "@/components/settings/appearance-settings";
import { requireProfile } from "@/lib/auth";
import { getBackgroundUrl } from "@/lib/profile-queries";

export const metadata: Metadata = {
  title: "Appearance · Day One",
};

// Light or dark, and the picture behind every page
export default async function AppearancePage() {
  const { profile } = await requireProfile();
  const photoUrl = await getBackgroundUrl(profile.background_path);

  return (
    <AppearanceSettings userId={profile.id} background={profile.background} photoUrl={photoUrl} />
  );
}
