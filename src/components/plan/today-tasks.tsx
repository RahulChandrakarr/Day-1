import Link from "next/link";
import ItemList from "@/components/plan/item-list";
import { SectionHead } from "@/components/ui/kit";
import type { PlanGoal, PlanItem } from "@/lib/plans";

// Today's plan tasks, shown on Overview and in the Daily journal.
export default function TodayTasks({
  date,
  goals,
  items,
  goalCount = 0,
  hideWhenDone = false,
  limit,
  title = "Today's plan",
}: {
  date: string;
  goals: PlanGoal[];
  items: PlanItem[];
  goalCount?: number;
  hideWhenDone?: boolean;
  limit?: number;
  title?: string;
}) {
  const pending = items.filter((i) => !i.done);
  const doneCount = items.length - pending.length;
  const href = `/plan?date=${date}`;

  // Goals exist but nothing is planned for the day yet
  if (items.length === 0) {
    if (goalCount === 0) return null;
    return (
      <Link
        href={href}
        className="flex min-h-11 items-center gap-3 rounded-inset border border-dashed border-ember/40 bg-ember/5 px-4 py-2.5"
      >
        <span className="text-base">🗓️</span>
        <span className="min-w-0 flex-1 text-sm font-medium">
          Plan today: {goalCount} goal{goalCount === 1 ? "" : "s"} running
        </span>
        <span className="text-ember">→</span>
      </Link>
    );
  }

  if (hideWhenDone && pending.length === 0) return null;

  const list = hideWhenDone ? pending : items;
  const shown = limit ? list.slice(0, limit) : list;
  const hidden = list.length - shown.length;

  return (
    <>
      <SectionHead
        title={title}
        href={href}
        link={`${doneCount}/${items.length}`}
      />
      <section className="card px-4 py-1.5">
        <ItemList
          goals={goals}
          level="day"
          period={date}
          items={shown}
          placeholder="Add a task for today"
          showGoal
        />
        {hidden > 0 && (
          <Link href={href} className="block pb-1.5 pt-1 text-xs font-semibold text-ember">
            +{hidden} more →
          </Link>
        )}
      </section>
    </>
  );
}
