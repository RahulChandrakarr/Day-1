import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/finance";
import { getJournalDays } from "@/lib/journal-queries";
import AddHub from "@/components/dashboard/add-hub";
import MobileNav from "@/components/dashboard/mobile-nav";
import AddEntry from "@/components/finance/add-entry";
import RegisterServiceWorker from "@/components/notifications/register-sw";
import Sidebar from "@/components/dashboard/sidebar";
import Backdrop from "@/components/ui/backdrop";
import { getAvatarUrl, getBackgroundUrl } from "@/lib/profile-queries";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const today = todayISO();
  // Nudge towards the journal until today's page exists
  const [{ profile }, journalToday] = await Promise.all([
    requireProfile(),
    getJournalDays(today, today),
  ]);
  const alerts = journalToday.length === 0 ? ["/daily"] : [];
  const [avatarUrl, backgroundUrl] = await Promise.all([
    getAvatarUrl(profile.avatar_path),
    profile.background === "upload" ? getBackgroundUrl(profile.background_path) : null,
  ]);

  return (
    // The Add menu and the app's one add-entry form live here, so the Add
    // button works from every page. The form's data streams in after the page.
    <AddHub
      entryForm={
        <Suspense fallback={null}>
          <AddEntry />
        </Suspense>
      }
    >
      <div className="flex min-h-dvh flex-1 text-paper">
        <Backdrop choice={profile.background} photoUrl={backgroundUrl} />
        <RegisterServiceWorker />
        <Sidebar profile={profile} alerts={alerts} avatarUrl={avatarUrl} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav alerts={alerts} />
          <main className="flex w-full min-w-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-5 md:px-6 md:py-6 md:pb-8 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </AddHub>
  );
}
