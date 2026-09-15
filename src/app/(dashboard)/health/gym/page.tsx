import Link from "next/link";
import PeriodNav from "@/components/finance/period-nav";
import GymTracker from "@/components/health/gym-tracker";
import PlanDialog from "@/components/health/plan-dialog";
import {
  addDays,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import { fullWeek, isoWeekday, WEEKDAYS } from "@/lib/health";
import { getGymCheckins, getGymPlan } from "@/lib/health-queries";

export default async function GymPage({ searchParams }: PageProps<"/health/gym">) {
  const today = todayISO();
  const date = parseDateParam((await searchParams).date);
  const weekday = isoWeekday(date);
  const weekStart = addDays(date, -(weekday - 1));
  const weekEnd = addDays(weekStart, 6);

  const [plan, checkins] = await Promise.all([
    getGymPlan(),
    getGymCheckins(weekStart, weekEnd),
  ]);
  const week = fullWeek(plan);
  const day = week[weekday - 1];
  const hasPlan = week.some((d) => d.rest || d.exercises.length > 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodNav
          label={date === today ? `Today · ${formatFullDate(date)}` : formatFullDate(date)}
          prevHref={`/health/gym?date=${addDays(date, -1)}`}
          nextHref={`/health/gym?date=${addDays(date, 1)}`}
          currentHref="/health/gym"
          isCurrent={date === today}
          currentLabel="Today"
        />
        {hasPlan && (
          <PlanDialog week={week} startDay={weekday} label="✏️ Edit plan" />
        )}
      </div>

      {!hasPlan ? (
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-paper/15 px-6 py-12 text-center">
          <span className="text-4xl">🏋️</span>
          <div>
            <h3 className="font-serif text-2xl">Plan your gym week</h3>
            <p className="mt-1 max-w-sm text-sm text-paper/55">
              Choose what you train each day, with sets, reps, weight or time.
              You set it once; every day you just tick exercises off.
            </p>
          </div>
          <PlanDialog
            week={week}
            startDay={weekday}
            label="Create weekly plan"
            variant="primary"
          />
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-paper/10 bg-surface/60 p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-medium uppercase tracking-wider text-paper/45">
                {WEEKDAYS[weekday - 1].label}
              </p>
              <h3 className="font-serif text-2xl sm:text-3xl">
                {day.rest ? "Rest day" : day.title || "Workout"}
              </h3>
            </div>
            <GymTracker
              key={date}
              day={day}
              date={date}
              doneIds={checkins[date] ?? []}
            />
          </section>

          <section className="rounded-3xl border border-paper/10 bg-surface/60 p-4 sm:p-6">
            <h3 className="mb-3 font-serif text-xl sm:text-2xl">This week</h3>
            <ul className="grid grid-cols-7 gap-1.5">
              {week.map((d, i) => {
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
                        selected
                          ? "border-ember/60 bg-ember/15"
                          : "border-paper/10 hover:bg-paper/5"
                      }`}
                    >
                      <span className="text-xs text-paper/55">
                        {WEEKDAYS[i].short}
                      </span>
                      <span className="text-base leading-none">
                        {d.rest ? "😴" : complete ? "✅" : total ? `${doneCount}/${total}` : "—"}
                      </span>
                      <span className="w-full truncate text-[10px] text-paper/45">
                        {d.rest ? "Rest" : d.title || (total ? "Workout" : "")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
