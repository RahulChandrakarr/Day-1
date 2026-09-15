import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Plan · Day One",
};

export default function PlanPage() {
  return <PageShell title="Plan" description="Goals and what's coming next." />;
}
