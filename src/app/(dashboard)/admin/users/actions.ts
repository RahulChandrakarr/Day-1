"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";

export type AddUserState = {
  error: string | null;
  success: string | null;
};

export async function addUser(
  _prev: AddUserState,
  formData: FormData,
): Promise<AddUserState> {
  const { supabase } = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  // The database function re-checks that the caller is an admin.
  const { error } = await supabase.rpc("admin_create_user", {
    p_email: email,
    p_password: password,
    p_full_name: fullName || null,
  });

  if (error) return { error: error.message, success: null };

  revalidatePath("/admin/users");
  return { error: null, success: `${email} can now sign in.` };
}
