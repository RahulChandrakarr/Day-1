import { Skeleton } from "@/components/ui/kit";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton lines={3} className="h-40" />
      <Skeleton order={1} lines={4} className="h-72" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
