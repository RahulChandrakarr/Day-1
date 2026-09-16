import type { Metadata } from "next";
import ReminderSettings from "@/components/notifications/reminder-settings";
import { defaultSettings, type ReminderSetting } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Notifications · Day One",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const [{ data: saved }, { count }] = await Promise.all([
    supabase
      .from("reminder_settings")
      .select("kind, enabled, hour, minute")
      .returns<ReminderSetting[]>(),
    supabase
      .from("push_subscriptions")
      .select("endpoint", { count: "exact", head: true }),
  ]);

  const settings = defaultSettings().map(
    (fallback) => saved?.find((s) => s.kind === fallback.kind) ?? fallback,
  );

  return (
    <ReminderSettings
      settings={settings}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
      devices={count ?? 0}
    />
  );
}
