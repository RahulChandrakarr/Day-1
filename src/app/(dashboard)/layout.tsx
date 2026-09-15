import { requireProfile } from "@/lib/auth";
import ChatProvider from "@/components/assistant/chat-provider";
import MobileNav from "@/components/dashboard/mobile-nav";
import Sidebar from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireProfile();
  const name =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  return (
    <ChatProvider name={name}>
      <div className="flex min-h-dvh flex-1 bg-ink text-paper">
        <Sidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav profile={profile} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-6 sm:px-6 md:px-10 md:py-10">
            {children}
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
