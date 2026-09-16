import { formatAmount, type Progress } from "@/lib/plans";

// Bar with "42%" and what it's measured by; an optional marker shows how
// much of the period has passed, so you can see if you're ahead or behind.
export default function ProgressBar({
  progress,
  unit,
  elapsed,
  compact = false,
}: {
  progress: Progress;
  unit?: string | null;
  elapsed?: number | null;
  compact?: boolean;
}) {
  const ratio = progress.ratio ?? 0;
  const percent = Math.round(ratio * 100);
  const behind = elapsed !== null && elapsed !== undefined && ratio + 0.05 < elapsed;
  const label =
    progress.target !== null && progress.amount !== null
      ? `${formatAmount(progress.amount, unit ?? null)} of ${formatAmount(progress.target, unit ?? null)}`
      : progress.total
        ? `${progress.done} of ${progress.total} done`
        : "Nothing planned yet";

  return (
    <div>
      <div className={`relative overflow-hidden rounded-full bg-paper/10 ${compact ? "h-1.5" : "h-2"}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            ratio >= 1 ? "bg-moss" : behind ? "bg-[#d98e4a]" : "bg-ember"
          }`}
          style={{ width: `${percent}%` }}
        />
        {elapsed !== null && elapsed !== undefined && elapsed > 0 && elapsed < 1 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-paper/50"
            style={{ left: `${elapsed * 100}%` }}
          />
        )}
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between gap-2 text-xs text-paper/50">
          <span className="truncate">{label}</span>
          <span className="shrink-0 tabular-nums">
            {progress.ratio === null ? "—" : `${percent}%`}
            {behind && " · behind"}
          </span>
        </div>
      )}
    </div>
  );
}
