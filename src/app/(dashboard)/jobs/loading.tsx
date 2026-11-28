import { PageSkeleton } from "@/components/ui/kit";
import PageShell from "@/components/dashboard/page-shell";

export default function Loading() {
  return (
    <PageShell title="Jobs" description="Openings from boards that publish them. Apply where they allow it.">
      <PageSkeleton rows={4} />
    </PageShell>
  );
}
