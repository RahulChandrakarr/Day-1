import { formatMoney } from "@/lib/finance";
import { Card, CardHead } from "@/components/ui/kit";

export type Slice = { label: string; value: number; color: string };

// Where the money sits: one bar, biggest share first, with the split listed
export default function AllocationCard({ slices }: { slices: Slice[] }) {
  const ordered = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = ordered.reduce((sum, s) => sum + s.value, 0);
  if (ordered.length < 2 || total <= 0) return null;

  return (
    <Card>
      <CardHead title="Where it sits" />
      <div className="flex h-3 overflow-hidden rounded-full bg-paper/10">
        {ordered.map((s) => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatMoney(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {ordered.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="min-w-0 flex-1 truncate text-paper/78">{s.label}</span>
            <span className="shrink-0 tabular-nums text-paper/65">
              {Math.round((s.value / total) * 100)}%
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(s.value)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
