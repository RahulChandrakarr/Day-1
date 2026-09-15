import type { Metadata } from "next";
import { requireAdmin, type Profile } from "@/lib/auth";
import PageShell from "@/components/dashboard/page-shell";
import AddUserForm from "./add-user-form";
import UserList from "./user-list";

export const metadata: Metadata = {
  title: "Users · Day One",
};

export default async function UsersPage() {
  const { supabase } = await requireAdmin();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  return (
    <PageShell title="Users" description="Everyone who can sign in to Day One.">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <UserList users={users ?? []} />
        <AddUserForm />
      </div>
    </PageShell>
  );
}
