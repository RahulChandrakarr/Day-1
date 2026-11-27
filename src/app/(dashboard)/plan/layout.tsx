import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import PlanTabs from "@/components/plan/plan-tabs";
import { Arrive } from "@/components/ui/kit";

export const metadata: Metadata = {
  title: "Plan · Day One",
};

export default function PlanLayout({ children }: LayoutProps<"/plan">) {
  return (
    <PageShell title="Plan" description="Year → month → week → today." frame>
      <div className="flex flex-col gap-4">
        <PlanTabs />
        <Arrive>{children}</Arrive>
      </div>
    </PageShell>
  );
}
