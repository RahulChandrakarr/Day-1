import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";
import PlanTabs from "@/components/plan/plan-tabs";

export const metadata: Metadata = {
  title: "Plan · Day One",
};

export default function PlanLayout({ children }: LayoutProps<"/plan">) {
  return (
    <PageShell title="Plan" description="Year → month → week → today.">
      <div className="flex flex-col gap-4 md:gap-5">
        <PlanTabs />
        {children}
      </div>
    </PageShell>
  );
}
