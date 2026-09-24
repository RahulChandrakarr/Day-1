import PeriodNav from "@/components/finance/period-nav";
import ItemList from "@/components/plan/item-list";
import ProgressBar from "@/components/plan/progress-bar";
import { Card, CardGrid, Empty, Section, Stack } from "@/components/ui/kit";
import {
  addMonths,
  formatMonth,
  formatShortDate,
  parseMonthParam,
  todayISO,
} from "@/lib/finance";
import {
  goalActiveIn,
  goalProgress,
  weekDays,
  weekOfMonth,
  weekPeriod,
  weekRange,
} from "@/lib/plans";
import { getPlanYear } from "@/lib/plan-queries";

export default async function PlanWeekPage({
  searchParams,
}: PageProps<"/plan/week">) {
  const params = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(params.month ?? today.slice(0, 7));
  const requested = Number(params.week);
  const week =
    requested >= 1 && requested <= 4
      ? requested
      : month === today.slice(0, 7)
        ? weekOfMonth(today)
        : 1;

  const { goals: allGoals, items, logs } = await getPlanYear(Number(month.slice(0, 4)));
  // Only goals running this month
  const goals = allGoals.filter((g) => goalActiveIn(g, month));
  const { from, to } = weekRange(month, week);
  const days = weekDays(month, week);
  const elapsed =
    today < from ? 0 : today > to ? 1 : (days.indexOf(today) + 1) / days.length;

  // Previous / next week, crossing into the neighbouring month
  const prev = week > 1 ? `month=${month}&week=${week - 1}` : `month=${addMonths(month, -1)}&week=4`;
  const next = week < 4 ? `month=${month}&week=${week + 1}` : `month=${addMonths(month, 1)}&week=1`;
  const isCurrent = today >= from && today <= to;

  return (
    <Stack>
      <PeriodNav
        label={`Week ${week} · ${formatMonth(month).split(" ")[0]} ${Number(from.slice(8))}–${Number(to.slice(8))}`}
        prevHref={`/plan/week?${prev}`}
        nextHref={`/plan/week?${next}`}
        currentHref="/plan/week"
        isCurrent={isCurrent}
        currentLabel="This week"
      />

      {goals.length === 0 ? (
        <Empty href="/plan/year">
          {allGoals.length === 0
            ? "Add a yearly goal first →"
            : "No goals run in this month. Check the start and end months on the Year tab →"}
        </Empty>
      ) : (
        <>
          <CardGrid>
            <Section title="This week's targets" href={`/plan/month?month=${month}`} link="Month">
              <Card>
            <ul className="flex flex-col gap-4">
              {goals.map((goal) => {
                const p = goalProgress(goal, items, logs, { month, week });
                return (
                  <li key={goal.id}>
                    <p className="mb-1.5 text-sm font-semibold">
                      {goal.emoji} {goal.title}
                    </p>
                    <ProgressBar progress={p} unit={goal.unit} elapsed={elapsed} />
                    <div className="mt-1">
                      <ItemList
                        goal={goal}
                        level="week"
                        period={weekPeriod(month, week)}
                        items={items.filter(
                          (i) =>
                            i.goal_id === goal.id &&
                            i.level === "week" &&
                            i.period === weekPeriod(month, week),
                        )}
                        placeholder="Add a target for this week"
                        allowTarget
                      />
                    </div>
                  </li>
                );
              })}
                </ul>
              </Card>
            </Section>

            <Section title="Day by day">
              <ul className="flex flex-col gap-2">
            {days.map((day) => {
              const dayItems = items.filter(
                (i) => i.level === "day" && i.period === day,
              );
              const done = dayItems.filter((i) => i.done).length;
              return (
                <li key={day}>
                  <Card className={day === today ? "border-ember/50" : ""}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <h4 className={`font-semibold ${day === today ? "text-ember" : ""}`}>
                        {day === today ? "Today · " : ""}
                        {formatShortDate(day)}
                      </h4>
                      {dayItems.length > 0 && (
                        <span className="text-xs text-paper/45">
                          {done}/{dayItems.length} done
                        </span>
                      )}
                    </div>
                    <ItemList
                      goals={goals}
                      level="day"
                      period={day}
                      items={dayItems}
                      placeholder="Add a task"
                      showGoal
                    />
                  </Card>
                </li>
              );
            })}
              </ul>
            </Section>
          </CardGrid>
        </>
      )}
    </Stack>
  );
}
