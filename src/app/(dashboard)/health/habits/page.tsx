import PeriodNav from "@/components/finance/period-nav";
import { CardGrid, Stack } from "@/components/ui/kit";
import AddHabit from "@/components/health/add-habit";
import HabitCard from "@/components/health/habit-card";
import {
  addDays,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import { reasonLabel, streak } from "@/lib/health";
import { getHabitCheckins } from "@/lib/health-queries";
import { getHabits } from "@/lib/journal-queries";

export default async function HabitsPage({
  searchParams,
}: PageProps<"/health/habits">) {
  const today = todayISO();
  const date = parseDateParam((await searchParams).date);

  // 60 days back is enough for streaks and the "most common reason" hint
  const [habits, checkins] = await Promise.all([
    getHabits(),
    getHabitCheckins(addDays(date, -60), date),
  ]);

  const doneToday = checkins.filter((c) => c.check_date === date && c.done).length;

  return (
    <Stack>
      <PeriodNav
        label={date === today ? `Today · ${formatFullDate(date)}` : formatFullDate(date)}
        prevHref={`/health/habits?date=${addDays(date, -1)}`}
        nextHref={`/health/habits?date=${addDays(date, 1)}`}
        currentHref="/health/habits"
        isCurrent={date === today}
        currentLabel="Today"
      />

      {habits.length > 0 && (
        <p className="text-sm text-paper/70">
          {doneToday} of {habits.length} habit{habits.length === 1 ? "" : "s"} done{" "}
          {date === today ? "today" : "this day"}.
        </p>
      )}

      {habits.length === 0 ? (
        <section className="card px-6 py-10 text-center">
          <span className="text-4xl">✅</span>
          <h3 className="mt-2 font-bold tracking-tight text-2xl">Track your habits</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-paper/70">
            Add something you want to build or quit. Each day, mark whether you
            managed it, how it felt, or what got in the way.
          </p>
        </section>
      ) : (
        <CardGrid layout="dense" align="start">
          {habits.map((habit) => {
            const own = checkins.filter((c) => c.habit_id === habit.id);
            const missed = own.filter((c) => !c.done && c.reason);
            const counts = new Map<string, number>();
            for (const c of missed)
              counts.set(c.reason!, (counts.get(c.reason!) ?? 0) + 1);
            const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
            return (
              <div key={habit.id} className="flex flex-col gap-1">
                <HabitCard
                  key={`${habit.id}-${date}`}
                  habit={habit}
                  date={date}
                  checkin={own.find((c) => c.check_date === date) ?? null}
                  history={own.filter((c) => c.check_date >= addDays(date, -6))}
                  streak={streak(own, date)}
                />
                {top && top[1] >= 2 && (
                  <p className="px-3 text-xs text-paper/60">
                    Most often missed because of{" "}
                    <span className="text-paper/78">
                      {reasonLabel(top[0]).toLowerCase()}
                    </span>{" "}
                    ({top[1]}× in 60 days)
                  </p>
                )}
              </div>
            );
          })}
        </CardGrid>
      )}

      <AddHabit existing={habits.map((h) => h.name)} />
    </Stack>
  );
}
