import { Skeleton } from "@/components/ui/kit";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-40" />
      <Skeleton className="h-72" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
