import PageShell from "@/components/dashboard/page-shell";
import { PageSkeleton } from "@/components/ui/kit";

export default function Loading() {
  return (
    <PageShell title="Overview">
      <PageSkeleton rows={6} layout="triple" />
    </PageShell>
  );
}
