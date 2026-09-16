import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import ReminderSettings from "@/components/notifications/reminder-settings";
import { defaultSettings, type ReminderSetting } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Settings · Day One",
};

export default async function SettingsPage() {
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
    <PageShell title="Settings" description="Notifications and reminders.">
      <ReminderSettings
        settings={settings}
        vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        devices={count ?? 0}
      />
    </PageShell>
  );
}
