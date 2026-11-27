import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import HealthTabs from "@/components/health/health-tabs";
import { Arrive } from "@/components/ui/kit";

export const metadata: Metadata = {
  title: "Health & Habits · Day One",
};

export default function HealthLayout({ children }: LayoutProps<"/health">) {
  return (
    <PageShell
      title="Health & Habits"
      description="Gym plan, workouts and habits."
      hideMobileDescription
      frame
    >
      <div className="flex flex-col gap-4">
        <HealthTabs />
        <Arrive>{children}</Arrive>
      </div>
    </PageShell>
  );
}
