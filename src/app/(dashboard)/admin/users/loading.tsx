import PageShell from "@/components/dashboard/page-shell";
import { PageSkeleton } from "@/components/ui/kit";

export default function Loading() {
  return (
    <PageShell title="Users" description="Everyone who can sign in to Day One.">
      <PageSkeleton rail />
    </PageShell>
  );
}
