import PeriodNav from "@/components/finance/period-nav";
import { LogProgress } from "@/components/plan/goal-actions";
import ItemList from "@/components/plan/item-list";
import ProgressBar from "@/components/plan/progress-bar";
import { Card, CardGrid, DarkCard, Empty, Section, Stack } from "@/components/ui/kit";
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
  const done = dayItems.filter((i) => i.done).length;

  const week = weekOfMonth(date);
  const numeric = goals.filter((g) => g.target_value);

  return (
    <Stack>
      <PeriodNav
        label={date === today ? `Today · ${formatFullDate(date)}` : formatFullDate(date)}
        prevHref={`/plan?date=${addDays(date, -1)}`}
        nextHref={`/plan?date=${addDays(date, 1)}`}
        currentHref="/plan"
        isCurrent={date === today}
        currentLabel="Today"
      />

      {month >= "2026-10" && month <= "2027-02" && <LoanPlan month={month} />}

      {goals.length === 0 ? (
        <Empty href="/plan/year">
          {allGoals.length === 0
            ? "Add a yearly goal first →"
            : "No goals run in this month. Check the start and end months on the Year tab →"}
        </Empty>
      ) : (
        <>
          <DarkCard>
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ember">
              {dayItems.length === 0
                ? "Nothing planned yet"
                : done === dayItems.length
                  ? "Day complete 🎉"
                  : `${done} of ${dayItems.length} done`}
            </p>
            <p className="mt-0.5 text-[13px] text-ink/80">
              Week {week} of the month. Every task here moves a yearly goal.
            </p>
          </DarkCard>

          <CardGrid>
            {monthItems.length > 0 && (
              <Section title="Milestones" href={`/plan/month?month=${month}`} link="Month">
                <Card>
                  <ItemList
                    goals={goals}
                    level="month"
                    period={month}
                    items={monthItems}
                    placeholder="Add a milestone for this month"
                    showGoal
                  />
                </Card>
              </Section>
            )}
            <Section title="Tasks" href={`/plan/week?month=${month}&week=${week}`} link="Week">
              <Card>
                <ItemList
                  goals={goals}
                  level="day"
                  period={date}
                  items={dayItems}
                  placeholder="What will you do today?"
                  showGoal
                />
              </Card>
            </Section>

            {numeric.length > 0 && (
              <Section title="Log progress">
                <ul className="flex flex-col gap-2">
                {numeric.map((goal) => {
                  const p = goalProgress(goal, items, logs, { month, week });
                  const dayTarget = periodTarget(goal, items, { day: date });
                  return (
                    <li key={goal.id}>
                      <Card>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold">
                            {goal.emoji} {goal.title}
                          </p>
                          {dayTarget !== null && (
                            <span className="shrink-0 text-xs text-paper/45">
                              ~{formatAmount(dayTarget, goal.unit)} a day
                            </span>
                          )}
                        </div>
                        <ProgressBar progress={p} unit={goal.unit} />
                        <p className="mb-2 mt-0.5 text-xs text-paper/40">This week</p>
                        <LogProgress goal={goal} date={date} />
                      </Card>
                    </li>
                  );
                })}
                </ul>
              </Section>
            )}
          </CardGrid>
        </>
      )}
    </Stack>
  );
}
