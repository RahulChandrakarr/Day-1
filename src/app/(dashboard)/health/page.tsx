import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Health · Day One",
};

export default function HealthPage() {
  return (
    <PageShell title="Health" description="Sleep, workouts and wellbeing." />
  );
}
