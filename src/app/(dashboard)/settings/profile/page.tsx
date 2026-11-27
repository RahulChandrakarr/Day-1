import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { logoutIcon, usersIcon } from "@/components/dashboard/nav";
import ProfileForm from "@/components/settings/profile-form";
import { Card, CardHead } from "@/components/ui/kit";
import { requireProfile } from "@/lib/auth";
import { getBodyProfile } from "@/lib/health-queries";
import { avatarUrl } from "@/lib/profile-queries";

export const metadata: Metadata = {
  title: "Profile · Day One",
};

const row =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-paper/80 transition hover:bg-paper/5 hover:text-paper";

export default async function ProfilePage() {
  const { profile } = await requireProfile();
  const body = await getBodyProfile();

  return (
    <div className="flex flex-col gap-3">
      <ProfileForm
        userId={profile.id}
        email={profile.email}
        fullName={profile.full_name ?? ""}
        avatarPath={profile.avatar_path}
        avatarUrl={avatarUrl(profile.avatar_path)}
        body={body}
      />

      {/* On phones this is the only way out: there's no top bar or menu */}
      <Card>
        <CardHead title="Account" aside={profile.email} />
        <div className="flex flex-col gap-1">
          {profile.role === "admin" && (
            <Link href="/admin/users" className={row}>
              {usersIcon}
              Manage users
            </Link>
          )}
          <form action={logout}>
            <button className={`${row} w-full`}>
              {logoutIcon}
              Sign out
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
