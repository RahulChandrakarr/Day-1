import type { Metadata } from "next";
import PdfLink from "@/components/settings/pdf-link";
import Link from "next/link";
import PageShell from "@/components/dashboard/page-shell";
import PeriodNav from "@/components/finance/period-nav";
import JournalEditor from "@/components/journal/journal-editor";
import {
  addDays,
  formatFullDate,
  parseDateParam,
  todayISO,
} from "@/lib/finance";
import { getHabitCheckins } from "@/lib/health-queries";
import { MOODS } from "@/lib/journal";
import { getPlanDay } from "@/lib/plan-queries";
import TodayTasks from "@/components/plan/today-tasks";
import {
  getHabits,
  getJournalDays,
  getJournalEntry,
} from "@/lib/journal-queries";

export const metadata: Metadata = {
  title: "Daily · Day One",
};

const weekday = new Intl.DateTimeFormat("en-IN", {
  weekday: "narrow",
  timeZone: "UTC",
});

export default async function DailyPage({ searchParams }: PageProps<"/daily">) {
  const today = todayISO();
  const date = parseDateParam((await searchParams).date);

  // Monday-to-Sunday week around the selected day
  const offset = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(date, -offset);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [{ entry, exists }, habits, days, habitCheckins, plan] =
    await Promise.all([
      getJournalEntry(date),
      getHabits(),
      getJournalDays(week[0], week[6]),
      getHabitCheckins(date, date),
      getPlanDay(date),
    ]);
  const byDate = new Map(days.map((d) => [d.entry_date, d]));

  return (
    <PageShell title="Daily" description="Your journal for the day.">
      <div className="flex flex-col gap-3">
        <PeriodNav
          label={
            date === today
              ? `Today · ${formatFullDate(date)}`
              : formatFullDate(date)
          }
          prevHref={`/daily?date=${addDays(date, -1)}`}
          nextHref={`/daily?date=${addDays(date, 1)}`}
          currentHref="/daily"
          isCurrent={date === today}
          currentLabel="Today"
        >
          <PdfLink variant="icon" href={`/api/reports/journal?month=${date.slice(0, 7)}`} label="Month PDF" />
        </PeriodNav>

        <nav aria-label="This week" className="grid grid-cols-7 gap-1.5 2xl:max-w-4xl">
          {week.map((d) => {
            const day = byDate.get(d);
            const mood = MOODS.find((m) => m.value === day?.mood);
            const selected = d === date;
            return (
              <Link
                key={d}
                href={d === today ? "/daily" : `/daily?date=${d}`}
                aria-current={selected ? "date" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-2xl border py-2 text-xs transition ${
                  selected
                    ? "border-ember/60 bg-ember/15 text-paper"
                    : "border-paper/10 text-paper/55 hover:bg-paper/5"
                } ${d > today ? "opacity-50" : ""}`}
              >
                <span>{weekday.format(new Date(`${d}T00:00:00Z`))}</span>
                <span className="text-sm font-medium">{Number(d.slice(8))}</span>
                <span className="flex h-5 items-center text-base leading-none">
                  {mood ? (
                    mood.emoji
                  ) : day ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-moss" />
                  ) : d === today ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <TodayTasks
          date={date}
          goals={plan.goals}
          items={plan.items}
          title={date === today ? "Today's plan" : "Plan for this day"}
        />

        <JournalEditor
          key={date}
          initial={entry}
          exists={exists}
          habits={habits}
          doneHabitIds={habitCheckins.filter((c) => c.done).map((c) => c.habit_id)}
          isToday={date === today}
        />
      </div>
    </PageShell>
  );
}
