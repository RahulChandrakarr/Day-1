import Link from "next/link";
import PeriodNav from "@/components/finance/period-nav";
import AddPrep from "@/components/health/add-prep";
import GymTracker from "@/components/health/gym-tracker";
import NextBlock from "@/components/health/next-block";
import { Card, Rail, Stack } from "@/components/ui/kit";
import PlanDialog from "@/components/health/plan-dialog";
import {
  addDays,
  formatFullDate,
  formatShortDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import { blockEnd, blockWeek } from "@/lib/fitness";
import { fullWeek, isoWeekday, WEEKDAYS } from "@/lib/health";
import {
  getCurrentBlock,
  getGymCheckins,
  getGymPlan,
} from "@/lib/health-queries";

export default async function GymPage({ searchParams }: PageProps<"/health/gym">) {
  const today = todayISO();
  const date = parseDateParam((await searchParams).date);
  const weekday = isoWeekday(date);
  const weekStart = addDays(date, -(weekday - 1));
  const weekEnd = addDays(weekStart, 6);

  const block = await getCurrentBlock();
  const [plan, checkins] = await Promise.all([
    getGymPlan(block?.id ?? null),
    getGymCheckins(weekStart, weekEnd),
  ]);
  const week = fullWeek(plan);
  const day = week[weekday - 1];
  const hasPlan = week.some((d) => d.rest || d.exercises.length > 0);
  const blockWeekNow = block ? blockWeek(block.start_date, date, block.weeks) : null;
  const ends = block ? blockEnd(block.start_date, block.weeks) : null;
  const finished = Boolean(block && ends && today > ends);
  // Plans from before warm-ups existed get a one-tap way to add them. Only one
  // banner shows at a time, and a finished block's comes first.
  const missingPrep =
    !finished &&
    week.some((d) => !d.rest && d.exercises.length > 0) &&
    !week.some((d) => d.exercises.some((e) => (e.phase ?? "main") !== "main"));

  // The week at a glance, shown beside today's workout on a wide screen
  const weekStrip = week.map((d, i) => {
    const dayDate = addDays(weekStart, i);
    const doneCount = d.exercises.filter((e) =>
      (checkins[dayDate] ?? []).includes(e.id),
    ).length;
    const total = d.exercises.length;
    const selected = dayDate === date;
    const complete = total > 0 && doneCount === total;
    return (
      <li key={d.weekday}>
        <Link
          href={dayDate === today ? "/health/gym" : `/health/gym?date=${dayDate}`}
          aria-current={selected ? "date" : undefined}
          className={`flex h-full flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-center transition ${
            selected ? "border-ember/60 bg-ember/15" : "border-paper/10 hover:bg-paper/5"
          }`}
        >
          <span className="text-xs text-paper/70">{WEEKDAYS[i].short}</span>
          <span className="text-base leading-none">
            {d.rest ? "😴" : complete ? "✅" : total ? `${doneCount}/${total}` : "—"}
          </span>
          <span className="w-full truncate text-[10px] text-paper/60">
            {d.rest ? "Rest" : d.title || (total ? "Workout" : "")}
          </span>
        </Link>
      </li>
    );
  });

  return (
    <Stack>
      {finished && block && (
        <NextBlock blockNumber={block.number} />
      )}

      <PeriodNav
        label={date === today ? `Today · ${formatFullDate(date)}` : formatFullDate(date)}
        prevHref={`/health/gym?date=${addDays(date, -1)}`}
        nextHref={`/health/gym?date=${addDays(date, 1)}`}
        currentHref="/health/gym"
        isCurrent={date === today}
        currentLabel="Today"
      >
        {hasPlan && (
          <PlanDialog
            week={week}
            startDay={weekday}
            blockId={block?.id ?? null}
            label="Edit plan"
            variant="icon"
          />
        )}
      </PeriodNav>

      {missingPrep && <AddPrep blockId={block?.id ?? null} />}

      {!hasPlan ? (
        <section className="flex flex-col items-center gap-4 card px-6 py-12 text-center">
          <span className="text-4xl">🏋️</span>
          <div>
            <h3 className="font-bold tracking-tight text-2xl">Build your training plan</h3>
            <p className="mt-1 max-w-sm text-sm text-paper/70">
              Add your height, weight and goal, and the app builds a 4-week plan
              for you: weeks 1–3 get harder, week 4 is lighter so you recover.
            </p>
          </div>
          <Link
            href="/health/body"
            className="flex h-11 items-center rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light"
          >
            Start with your body details
          </Link>
        </section>
      ) : (
        <Rail
          at="2xl"
          aside={
            <Card>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="font-bold tracking-tight text-[19px]">This week</h3>
                {block && ends && (
                  <span className="text-xs text-paper/60">
                    Block ends {formatShortDate(ends)}
                  </span>
                )}
              </div>
              <ul className="grid grid-cols-7 gap-1.5">{weekStrip}</ul>
            </Card>
          }
        >
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 font-bold tracking-tight text-2xl sm:text-3xl">
                {day.rest ? "Rest day" : day.title || "Workout"}
              </h3>
              {blockWeekNow && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    blockWeekNow.deload
                      ? "bg-moss/15 text-moss"
                      : "bg-ember/15 text-ember"
                  }`}
                >
                  {blockWeekNow.label}
                  {blockWeekNow.deload && " · deload"}
                </span>
              )}
            </div>

            {blockWeekNow && !day.rest && (
              <p className="-mt-2 mb-4 text-sm text-paper/65">
                {blockWeekNow.advice}
              </p>
            )}

            <GymTracker
              key={date}
              day={day}
              date={date}
              doneIds={checkins[date] ?? []}
              week={blockWeekNow}
            />
          </Card>

        </Rail>
      )}
    </Stack>
  );
}
