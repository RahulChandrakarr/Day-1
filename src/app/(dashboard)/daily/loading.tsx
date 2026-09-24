import PageShell from "@/components/dashboard/page-shell";
import { PageSkeleton } from "@/components/ui/kit";

export default function Loading() {
  return (
    <PageShell title="Daily" description="Your journal for the day.">
      <PageSkeleton rows={3} />
    </PageShell>
  );
}
