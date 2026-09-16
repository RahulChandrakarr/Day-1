import Link from "next/link";
import PeriodNav from "@/components/finance/period-nav";
import GoalSheet from "@/components/plan/goal-sheet";
import { LogProgress, SplitButton } from "@/components/plan/goal-actions";
import ProgressBar from "@/components/plan/progress-bar";
import { Card, DarkCard, Empty } from "@/components/ui/kit";
import { formatMonthShort, parseYearParam, todayISO } from "@/lib/finance";
import { goalProgress, monthsOfYear } from "@/lib/plans";
import { getPlanYear } from "@/lib/plan-queries";

// How much of the year has gone, for the "ahead / behind" marker
function yearElapsed(year: number, today: string) {
  const now = Date.parse(`${today}T00:00:00Z`);
  const start = Date.parse(`${year}-01-01T00:00:00Z`);
  const end = Date.parse(`${year + 1}-01-01T00:00:00Z`);
  return Math.min(Math.max((now - start) / (end - start), 0), 1);
}

export default async function PlanYearPage({ searchParams }: PageProps<"/plan">) {
  const today = todayISO();
  const year = parseYearParam((await searchParams).year);
  const currentMonth = today.slice(0, 7);
  const { goals, items, logs } = await getPlanYear(year);
  const elapsed = yearElapsed(year, today);

  const progress = goals.map((g) => goalProgress(g, items, logs));
  const measured = progress.filter((p) => p.ratio !== null);
  const behind = measured.filter((p) => (p.ratio ?? 0) + 0.05 < elapsed).length;
  const overall = measured.length
    ? measured.reduce((s, p) => s + (p.ratio ?? 0), 0) / measured.length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <PeriodNav
        label={`${year} plan`}
        prevHref={`/plan?year=${year - 1}`}
        nextHref={`/plan?year=${year + 1}`}
        currentHref="/plan"
        isCurrent={year === Number(today.slice(0, 4))}
        currentLabel="This year"
      />

      {goals.length > 0 && (
        <DarkCard className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--ember) ${Math.max(overall * 360, 2)}deg, color-mix(in srgb, var(--ink) 18%, transparent) 0)`,
            }}
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-paper text-[11px] font-bold">
              {Math.round(overall * 100)}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ember">
              {year} so far
            </p>
            <p className="mt-0.5 text-[13px]">
              {goals.length} goal{goals.length === 1 ? "" : "s"} ·{" "}
              {Math.round(elapsed * 100)}% of the year gone
            </p>
            <p className="text-[13px] text-ink/65">
              {behind > 0
                ? `${behind} goal${behind === 1 ? "" : "s"} behind pace`
                : measured.length
                  ? "Everything on pace"
                  : "Add tasks or log progress to start tracking"}
            </p>
          </div>
        </DarkCard>
      )}

      <GoalSheet year={year} label="＋ New goal" />

      {goals.length === 0 ? (
        <Empty>
          Start with what you want this year to be about: saving, fitness,
          learning, career. Each goal breaks down into months, weeks and days.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal, index) => {
            const p = progress[index];
            return (
              <li key={goal.id}>
                <Card>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{goal.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-xl leading-tight">{goal.title}</h3>
                      {goal.notes && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-paper/55">
                          {goal.notes}
                        </p>
                      )}
                    </div>
                    <GoalSheet year={year} goal={goal} label="Edit" variant="link" />
                  </div>

                  <div className="mt-3">
                    <ProgressBar progress={p} unit={goal.unit} elapsed={elapsed} />
                  </div>

                  {/* Month by month */}
                  <div className="mt-3 grid grid-cols-12 gap-1">
                    {monthsOfYear(year).map((month) => {
                      const mp = goalProgress(goal, items, logs, { month });
                      const ratio = mp.ratio ?? 0;
                      const past = month < currentMonth;
                      return (
                        <Link
                          key={month}
                          href={`/plan/month?month=${month}`}
                          title={`${formatMonthShort(month)}: ${mp.ratio === null ? "nothing planned" : `${Math.round(ratio * 100)}%`}`}
                          className="flex flex-col items-center gap-1"
                        >
                          <span className="flex h-10 w-full items-end overflow-hidden rounded-md bg-paper/[0.07]">
                            <span
                              className={`w-full rounded-md ${
                                ratio >= 1 ? "bg-moss" : past && ratio < 1 && mp.ratio !== null ? "bg-[#d98e4a]" : "bg-ember"
                              }`}
                              style={{ height: `${Math.max(ratio * 100, mp.ratio === null ? 0 : 6)}%` }}
                            />
                          </span>
                          <span
                            className={`text-[9px] ${month === currentMonth ? "font-bold text-ember" : "text-paper/40"}`}
                          >
                            {formatMonthShort(month).slice(0, 1)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {goal.target_value && (
                      <SplitButton
                        goal={goal}
                        mode="months"
                        period={year === Number(today.slice(0, 4)) ? currentMonth : `${year}-01`}
                        label="Split evenly across months"
                      />
                    )}
                    <Link
                      href={`/plan/month?month=${year === Number(today.slice(0, 4)) ? currentMonth : `${year}-01`}`}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-ember hover:bg-ember/10"
                    >
                      Plan this month →
                    </Link>
                  </div>

                  {goal.target_value && year === Number(today.slice(0, 4)) && (
                    <div className="mt-3">
                      <LogProgress goal={goal} date={today} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
