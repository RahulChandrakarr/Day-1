import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/finance";
import { getJournalDays } from "@/lib/journal-queries";
import AddHub from "@/components/dashboard/add-hub";
import MobileNav from "@/components/dashboard/mobile-nav";
import NavProgress from "@/components/dashboard/nav-progress";
import AddEntry from "@/components/finance/add-entry";
import RegisterServiceWorker from "@/components/notifications/register-sw";
import Sidebar from "@/components/dashboard/sidebar";
import Backdrop from "@/components/ui/backdrop";
import { avatarUrl, backgroundUrl } from "@/lib/profile-queries";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Started now, but not waited for: the dot it decides is sent after the frame
  const alerts = journalNudge();
  // The one lookup the frame waits for: who this is and which background they
  // picked. Everything else here follows the frame instead of holding it up,
  // so opening the app shows the frame and the page's placeholder straight away.
  const { profile } = await requireProfile();
  const photo = avatarUrl(profile.avatar_path);

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
        <Backdrop
          choice={profile.background}
          photoUrl={profile.background === "upload" ? backgroundUrl(profile.background_path) : null}
        />
        <RegisterServiceWorker />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Sidebar profile={profile} alerts={alerts} avatarUrl={photo} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav profile={profile} avatarUrl={photo} alerts={alerts} />
          <main className="flex w-full min-w-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-5 md:px-6 md:py-6 md:pb-8 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </AddHub>
  );
}

// The tabs that get a dot: Daily, until today's journal page exists. Started
// here but not waited for; the tab bars show the dot when the answer lands
// (see AlertDot). If the lookup fails there is just no dot.
async function journalNudge(): Promise<string[]> {
  try {
    const today = todayISO();
    const days = await getJournalDays(today, today);
    return days.length === 0 ? ["/daily"] : [];
  } catch {
    return [];
  }
}
