import Link from "next/link";
import ItemList from "@/components/plan/item-list";
import { SectionHead } from "@/components/ui/kit";
import type { PlanGoal, PlanItem } from "@/lib/plans";

// Today's plan tasks, shown on Overview and in the Daily journal.
export default function TodayTasks({
  date,
  goals,
  items,
  hideWhenDone = false,
  title = "Today's plan",
}: {
  date: string;
  goals: PlanGoal[];
  items: PlanItem[];
  hideWhenDone?: boolean;
  title?: string;
}) {
  const pending = items.filter((i) => !i.done);
  if (items.length === 0 || (hideWhenDone && pending.length === 0)) return null;

  return (
    <>
      <SectionHead title={title} href={`/plan/today?date=${date}`} link="Plan" />
      <section className="rounded-[18px] border border-paper/10 bg-surface px-4 py-2">
        <ItemList
          goals={goals}
          level="day"
          period={date}
          items={hideWhenDone ? pending : items}
          placeholder="Add a task for today"
          showGoal
        />
        <p className="pb-1 pt-2 text-xs text-paper/40">
          {items.length - pending.length} of {items.length} done ·{" "}
          <Link href="/plan" className="text-ember">
            see how it moves your year
          </Link>
        </p>
      </section>
    </>
  );
}
