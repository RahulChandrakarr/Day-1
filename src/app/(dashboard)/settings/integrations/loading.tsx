import { Skeleton } from "@/components/ui/kit";

// The rows, closed, as the page first shows them
export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 max-w-lg rounded-inset" />
      <Skeleton className="h-[76px]" />
      <Skeleton className="h-[76px]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
