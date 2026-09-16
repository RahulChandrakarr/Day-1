import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/finance";
import { getJournalDays } from "@/lib/journal-queries";
import MobileNav from "@/components/dashboard/mobile-nav";
import RegisterServiceWorker from "@/components/notifications/register-sw";
import Sidebar from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const today = todayISO();
  // Nudge towards the journal until today's page exists
  const [{ profile }, journalToday] = await Promise.all([
    requireProfile(),
    getJournalDays(today, today),
  ]);
  const alerts = journalToday.length === 0 ? ["/daily"] : [];

  return (
    <div className="flex min-h-dvh flex-1 bg-ink text-paper">
      <RegisterServiceWorker />
      <Sidebar profile={profile} alerts={alerts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav profile={profile} alerts={alerts} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-5 sm:px-6 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
