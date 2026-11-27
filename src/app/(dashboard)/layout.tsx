import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/finance";
import { getJournalDays } from "@/lib/journal-queries";
import QuickAssistant from "@/components/assistant/quick-assistant";
import MobileNav from "@/components/dashboard/mobile-nav";
import RegisterServiceWorker from "@/components/notifications/register-sw";
import Sidebar from "@/components/dashboard/sidebar";
import Backdrop from "@/components/ui/backdrop";
import { getAvatarUrl, getBackgroundUrl } from "@/lib/profile-queries";
import { getAssistantName } from "@/lib/assistant-memory";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const today = todayISO();
  // Nudge towards the journal until today's page exists
  const [{ profile }, journalToday, assistantName] = await Promise.all([
    requireProfile(),
    getJournalDays(today, today),
    getAssistantName().catch(() => "Romi"),
  ]);
  const alerts = journalToday.length === 0 ? ["/daily"] : [];
  const [avatarUrl, backgroundUrl] = await Promise.all([
    getAvatarUrl(profile.avatar_path),
    profile.background === "upload" ? getBackgroundUrl(profile.background_path) : null,
  ]);

  return (
    <div className="flex min-h-dvh flex-1 text-paper">
      <Backdrop choice={profile.background} photoUrl={backgroundUrl} />
      <RegisterServiceWorker />
      <Sidebar profile={profile} alerts={alerts} avatarUrl={avatarUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav alerts={alerts} />
        <main className="flex w-full min-w-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-5 md:px-6 md:py-6 md:pb-8 xl:px-8">
          {children}
        </main>
      </div>
      <QuickAssistant name={assistantName} />
    </div>
  );
}
