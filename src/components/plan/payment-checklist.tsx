import ItemList from "@/components/plan/item-list";
import { formatMonth } from "@/lib/finance";
import type { PlanGoal, PlanItem } from "@/lib/plans";

// Every loan and trip payment, month by month, with a box to tick when paid.
export default function PaymentChecklist({
  goals,
  items,
}: {
  goals: PlanGoal[];
  items: PlanItem[];
}) {
  const periods = [...new Set(items.map((item) => item.period))].sort();

  return (
    <div className="flex flex-col gap-4">
      {periods.map((period) => {
        const rows = items.filter((item) => item.period === period);
        const done = rows.filter((item) => item.done).length;
        return (
          <section key={period}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold">{formatMonth(period)}</h3>
              <p className="text-xs tabular-nums text-paper/65">
                {done} of {rows.length} paid
              </p>
            </div>
            <ItemList goals={goals} level="month" period={period} items={rows} placeholder="" hideAdd />
          </section>
        );
      })}
    </div>
  );
}
