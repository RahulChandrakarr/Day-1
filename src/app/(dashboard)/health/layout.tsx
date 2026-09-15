import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import HealthTabs from "@/components/health/health-tabs";

export const metadata: Metadata = {
  title: "Health & Habits · Day One",
};

export default function HealthLayout({ children }: LayoutProps<"/health">) {
  return (
    <PageShell
      title="Health & Habits"
      description="Gym plan, workouts and habits."
      hideMobileDescription
    >
      <div className="flex flex-col gap-4 md:gap-6">
        <HealthTabs />
        {children}
      </div>
    </PageShell>
  );
}
