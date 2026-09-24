import Link from "next/link";
import PdfLink from "@/components/settings/pdf-link";
import PeriodNav from "@/components/finance/period-nav";
import { LogProgress, SplitButton } from "@/components/plan/goal-actions";
import ItemList from "@/components/plan/item-list";
import ProgressBar from "@/components/plan/progress-bar";
import { CardGrid, Stack, Card, Empty } from "@/components/ui/kit";
import {
  addMonths,
  daysInMonth,
  formatMonth,
  parseMonthParam,
  todayISO,
} from "@/lib/finance";
import {
  goalActiveIn,
  formatAmount,
  goalProgress,
  periodTarget,
  weekOfMonth,
  weekRange,
  WEEKS,
} from "@/lib/plans";
import { getPlanYear } from "@/lib/plan-queries";

export default async function PlanMonthPage({
  searchParams,
}: PageProps<"/plan/month">) {
  const today = todayISO();
  const month = parseMonthParam((await searchParams).month);
  const { goals: allGoals, items, logs } = await getPlanYear(Number(month.slice(0, 4)));
  // Only goals running this month
  const goals = allGoals.filter((g) => goalActiveIn(g, month));
  const isCurrent = month === today.slice(0, 7);
  const elapsed = isCurrent
    ? Number(today.slice(8)) / daysInMonth(month)
    : month < today.slice(0, 7)
      ? 1
      : 0;
  const currentWeek = isCurrent ? weekOfMonth(today) : null;

  return (
    <Stack>
      <PeriodNav
        label={formatMonth(month)}
        prevHref={`/plan/month?month=${addMonths(month, -1)}`}
        nextHref={`/plan/month?month=${addMonths(month, 1)}`}
        currentHref="/plan/month"
        isCurrent={isCurrent}
        currentLabel="This month"
      >
        <PdfLink variant="icon" href={`/api/reports/plan?month=${month}`} label="Month PDF" />
      </PeriodNav>

      {goals.length === 0 ? (
        <Empty href="/plan/year">
          {allGoals.length === 0
            ? "Add a yearly goal first →"
            : "No goals run in this month. Check the start and end months on the Year tab →"}
        </Empty>
      ) : (
        <CardGrid layout="triple">
          {goals.map((goal) => {
          const p = goalProgress(goal, items, logs, { month });
          const target = periodTarget(goal, items, { month });
          const monthItems = items.filter(
            (i) =>
              i.goal_id === goal.id && i.level === "month" && i.period === month,
          );
          return (
            <Card key={goal.id}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="min-w-0 truncate font-serif text-xl">
                  {goal.emoji} {goal.title}
                </h3>
                {target !== null && (
                  <span className="shrink-0 text-xs text-paper/50">
                    target {formatAmount(target, goal.unit)}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <ProgressBar progress={p} unit={goal.unit} elapsed={elapsed} />
              </div>

              <p className="mb-1 mt-4 text-xs font-medium text-paper/50">
                This month&apos;s milestones
              </p>
              <ItemList
                goal={goal}
                level="month"
                period={month}
                items={monthItems}
                placeholder="Add a milestone for this month"
                allowTarget
              />

              <p className="mb-2 mt-4 text-xs font-medium text-paper/50">Weeks</p>
              <div className="grid grid-cols-2 gap-2">
                {WEEKS.map((week) => {
                  const wp = goalProgress(goal, items, logs, { month, week });
                  const { from, to } = weekRange(month, week);
                  return (
                    <Link
                      key={week}
                      href={`/plan/week?month=${month}&week=${week}`}
                      className={`rounded-inset border p-2.5 transition hover:border-paper/25 ${
                        week === currentWeek
                          ? "border-ember/50 bg-ember/5"
                          : "border-paper/10"
                      }`}
                    >
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold">Week {week}</span>
                        <span className="text-paper/45">
                          {Number(from.slice(8))}–{Number(to.slice(8))}
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar progress={wp} unit={goal.unit} compact />
                      </div>
                      <p className="mt-1 text-[11px] text-paper/50">
                        {wp.ratio === null
                          ? "Plan it →"
                          : `${Math.round((wp.ratio ?? 0) * 100)}%`}
                      </p>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(goal.target_value ||
                  monthItems.some((i) => i.target_value !== null)) && (
                  <SplitButton
                    goal={goal}
                    mode="weeks"
                    period={month}
                    label="Split month into 4 weeks"
                  />
                )}
              </div>
              {goal.target_value && isCurrent && (
                <div className="mt-3">
                  <LogProgress goal={goal} date={today} />
                </div>
              )}
              </Card>
            );
          })}
        </CardGrid>
      )}
    </Stack>
  );
}
