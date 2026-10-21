import ItemList from "@/components/plan/item-list";
import { Card } from "@/components/ui/kit";
import { formatMonth } from "@/lib/finance";
import type { PlanGoal, PlanItem } from "@/lib/plans";

// Every loan and trip payment, with a box to tick when it is paid.
export default function PaymentChecklist({
  goals,
  items,
}: {
  goals: PlanGoal[];
  items: PlanItem[];
}) {
  const periods = [...new Set(items.map((item) => item.period))].sort();

  return (
    <div className="flex flex-col gap-3">
      {periods.map((period) => {
        const rows = items.filter((item) => item.period === period);
        const done = rows.filter((item) => item.done).length;
        return (
          <Card key={period}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-xl">{formatMonth(period)}</h3>
              <p className="text-xs tabular-nums text-paper/50">
                {done}/{rows.length}
              </p>
            </div>
            <ItemList
              goals={goals}
              level="month"
              period={period}
              items={rows}
              placeholder=""
              hideAdd
            />
          </Card>
        );
      })}
    </div>
  );
}
