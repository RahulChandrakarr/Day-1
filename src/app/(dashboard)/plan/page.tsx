import PeriodNav from "@/components/finance/period-nav";
import { LogProgress } from "@/components/plan/goal-actions";
import ItemList from "@/components/plan/item-list";
import ProgressBar from "@/components/plan/progress-bar";
import { Card, CardGrid, Empty, Section, Stack } from "@/components/ui/kit";
import {
  addDays,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import {
  goalActiveIn,
  formatAmount,
  goalProgress,
  periodTarget,
  weekOfMonth,
} from "@/lib/plans";
import LoanPlan, { LOAN_PLAN_TITLE } from "@/components/plan/loan-plan";
import { getPlanYear } from "@/lib/plan-queries";

const doneLabel = (done: number, total: number) =>
  total === 0 ? undefined : done === total ? "All done 🎉" : `${done} of ${total} done`;

export default async function PlanTodayPage({
  searchParams,
}: PageProps<"/plan">) {
  const today = todayISO();
  const date = parseDateParam((await searchParams).date);
  const month = date.slice(0, 7);
  const { goals: allGoals, items, logs } = await getPlanYear(Number(date.slice(0, 4)));
  // Only goals running this month
  const goals = allGoals.filter((g) => goalActiveIn(g, month));
  const dayItems = items.filter((i) => i.level === "day" && i.period === date);
  const loanIds = new Set(
    allGoals.filter((g) => g.title === LOAN_PLAN_TITLE).map((g) => g.id),
  );
  const activeGoalIds = new Set(goals.map((g) => g.id));
  const monthItems = items.filter(
    (i) =>
      i.level === "month" &&
      i.period === month &&
      activeGoalIds.has(i.goal_id) &&
      !loanIds.has(i.goal_id),
  );

  const week = weekOfMonth(date);
  const numeric = goals.filter((g) => g.target_value);
  const isToday = date === today;

  return (
    <Stack>
      <PeriodNav
        label={isToday ? `Today · ${formatFullDate(date)}` : formatFullDate(date)}
        prevHref={`/plan?date=${addDays(date, -1)}`}
        nextHref={`/plan?date=${addDays(date, 1)}`}
        currentHref="/plan"
        isCurrent={isToday}
        currentLabel="Today"
      />

      {goals.length === 0 ? (
        <Empty href="/plan/year">
          {allGoals.length === 0
            ? "Add a yearly goal first →"
            : "No goals run in this month. Check the start and end months on the Year tab →"}
        </Empty>
      ) : (
        <CardGrid align="start">
          <Section
            title={isToday ? "Today's tasks" : "Tasks"}
            aside={doneLabel(dayItems.filter((i) => i.done).length, dayItems.length)}
          >
            <Card className="py-2">
              <ItemList
                goals={goals}
                level="day"
                period={date}
                items={dayItems}
                placeholder={isToday ? "What will you do today?" : "Add a task"}
                showGoal
                voice
              />
            </Card>
          </Section>

          {monthItems.length > 0 && (
            <Section
              title="This month"
              aside={doneLabel(monthItems.filter((i) => i.done).length, monthItems.length)}
            >
              <Card className="py-2">
                <ItemList
                  goals={goals}
                  level="month"
                  period={month}
                  items={monthItems}
                  placeholder="Add a milestone"
                  showGoal
                />
              </Card>
            </Section>
          )}

          {numeric.length > 0 && (
            <Section title="Log progress" aside="This week">
              <Card className="py-1">
                <ul className="divide-y divide-paper/[0.06]">
                  {numeric.map((goal) => {
                    const p = goalProgress(goal, items, logs, { month, week });
                    const dayTarget = periodTarget(goal, items, { day: date });
                    return (
                      <li key={goal.id} className="py-4">
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold">
                            {goal.emoji} {goal.title}
                          </p>
                          {dayTarget !== null && (
                            <span className="shrink-0 text-xs text-paper/60">
                              ~{formatAmount(dayTarget, goal.unit)} a day
                            </span>
                          )}
                        </div>
                        <ProgressBar progress={p} unit={goal.unit} />
                        <div className="mt-2.5">
                          <LogProgress goal={goal} date={date} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </Section>
          )}
        </CardGrid>
      )}

      {month >= "2026-10" && month <= "2027-02" && <LoanPlan month={month} />}
    </Stack>
  );
}
