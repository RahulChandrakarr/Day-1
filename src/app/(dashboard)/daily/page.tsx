import type { Metadata } from "next";
import PageShell from "@/components/dashboard/page-shell";

export const metadata: Metadata = {
  title: "Daily · Day One",
};

export default function DailyPage() {
  return <PageShell title="Daily" description="Today's tasks and routines." />;
}
