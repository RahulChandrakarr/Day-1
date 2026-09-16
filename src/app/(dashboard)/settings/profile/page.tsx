import type { Metadata } from "next";
import ProfileForm from "@/components/settings/profile-form";
import { requireProfile } from "@/lib/auth";
import { getBodyProfile } from "@/lib/health-queries";
import { getAvatarUrl } from "@/lib/profile-queries";

export const metadata: Metadata = {
  title: "Profile · Day One",
};

export default async function ProfilePage() {
  const { profile } = await requireProfile();
  const [avatarUrl, body] = await Promise.all([
    getAvatarUrl(profile.avatar_path),
    getBodyProfile(),
  ]);

  return (
    <ProfileForm
      userId={profile.id}
      email={profile.email}
      fullName={profile.full_name ?? ""}
      avatarPath={profile.avatar_path}
      avatarUrl={avatarUrl}
      body={body}
    />
  );
}
