import type { Metadata } from "next";
import ReportsPanel from "@/components/settings/reports-panel";
import { todayISO } from "@/lib/finance";

export const metadata: Metadata = {
  title: "Reports · Day One",
};

export default function ReportsPage() {
  return <ReportsPanel today={todayISO()} />;
}
