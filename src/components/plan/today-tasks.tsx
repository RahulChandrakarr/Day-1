import Link from "next/link";
import ItemList from "@/components/plan/item-list";
import PlanQuestions from "@/components/plan/plan-questions";
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
  streak = 0,
  noteLines = [],
  gaps = [],
  questions = [],
  answers = [],
}: {
  date: string;
  goals: PlanGoal[];
  items: PlanItem[];
  goalCount?: number;
  hideWhenDone?: boolean;
  limit?: number;
  title?: string;
  streak?: number;
  noteLines?: string[];
  gaps?: string[];
  questions?: string[];
  answers?: string[];
}) {
  const pending = items.filter((i) => !i.done);
  const doneCount = items.length - pending.length;
  const href = `/plan?date=${date}`;

  const showReview = noteLines.length > 0 || gaps.length > 0 || questions.length > 0;

  // Goals exist but nothing is planned for the day yet
  if (items.length === 0 && !showReview) {
    if (goalCount === 0) return null;
    return (
      <Link
        href={href}
        className="card flex min-h-11 items-center gap-3 rounded-inset border-dashed border-ember/40 bg-ember/5 px-4 py-2.5"
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
        link={
          streak > 0
            ? `${streak}-day streak`
            : `${doneCount}/${items.length}`
        }
      />
      <section className="card px-4 py-1.5">
        {streak > 0 && (
          <p className="pt-2 text-[13px] text-moss">
            {streak} day{streak === 1 ? "" : "s"} checked off. You are showing up.
          </p>
        )}
        {noteLines.length > 0 && (
          <div className="flex flex-col gap-1 py-2">
            {noteLines.map((line) => (
              <p key={line} className="text-[13px] text-paper/72">
                {line}
              </p>
            ))}
          </div>
        )}
        {gaps.length > 0 && (
          <ul className="flex flex-col gap-1 py-2">
            {gaps.map((gap) => (
              <li key={gap} className="text-[13px] text-ember">
                {gap}
              </li>
            ))}
          </ul>
        )}
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
        {/* Five questions are a lot to show all day; they wait behind one line */}
        {questions.length > 0 && (
          <details className="group border-t border-paper/[0.06]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex-1">Reflect on today&apos;s plan</span>
              <span className="text-xs text-paper/60">
                {answers.filter((a) => a.trim()).length} of {questions.length} answered
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-paper/50 transition-transform group-open:rotate-180">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <PlanQuestions date={date} questions={questions} answers={answers} />
          </details>
        )}
      </section>
    </>
  );
}
