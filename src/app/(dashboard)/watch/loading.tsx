import { PageSkeleton } from "@/components/ui/kit";
import PageShell from "@/components/dashboard/page-shell";

export default function Loading() {
  return (
    <PageShell
      title="Watch"
      description="YouTube in the app. Instagram is your own professional posts, if you link it."
    >
      <PageSkeleton rows={4} />
    </PageShell>
  );
}
