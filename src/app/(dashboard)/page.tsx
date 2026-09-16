import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import GymChecklist from "@/components/health/gym-checklist";
import HabitRow from "@/components/health/habit-row";
import {
  addDays,
  categoryBreakdown,
  formatMoney,
  formatMonthShort,
  todayISO,
  totalsOf,
} from "@/lib/finance";
import { blockWeek } from "@/lib/fitness";
import { streak } from "@/lib/health";
import { getOverview } from "@/lib/overview-query";
import { getPlanDay } from "@/lib/plan-queries";
import TodayTasks from "@/components/plan/today-tasks";
import Link from "next/link";
import { Empty, ReminderChip, SectionHead } from "@/components/ui/kit";

export const metadata: Metadata = {
  title: "Overview · Day One",
};

export default async function OverviewPage() {
  const today = todayISO();
  const {
    transactions,
    balances,
    savingsWorth,
    journalToday,
    block,
    planDay,
    gymCheckins,
    habits,
    habitCheckins,
    moods,
    bodyLogs,
  } = await getOverview();
  const plan = await getPlanDay(today);
  const pendingPlan = plan.items.filter((i) => !i.done);

  // Money, kept short
  const todayTx = transactions.filter((t) => t.occurred_on === today);
  const spentToday = totalsOf(todayTx).expense;
  const topToday = categoryBreakdown(todayTx, "expense").slice(0, 3);
  const monthNet = totalsOf(transactions).net;
  const worth = savingsWorth;
  const owe = balances.owe;

  // Gym: only what's still to tick off today
  const gymDay = planDay ?? { weekday: 0, title: "", rest: false, exercises: [] };
  const hasPlan = planDay !== null;
  const doneIds = gymCheckins[today] ?? [];
  const pendingExercises = gymDay.rest
    ? []
    : gymDay.exercises.filter((e) => !doneIds.includes(e.id));
  const workoutDone =
    !gymDay.rest && gymDay.exercises.length > 0 && pendingExercises.length === 0;

  // Habits still to check in
  const pendingHabits = habits.filter(
    (h) => !habitCheckins.some((c) => c.habit_id === h.id && c.check_date === today),
  );
  const journalWritten = journalToday;
  const moneyLogged = todayTx.length > 0;

  // Small reminders for the things without their own card here
  const reminders: ReactNode[] = [];
  if (!journalWritten)
    reminders.push(
      <ReminderChip key="journal" href="/daily" emoji="📝" title="Journal" />,
    );
  if (!moneyLogged)
    reminders.push(
      <ReminderChip
        key="money"
        href="/financial/daily?add=entry"
        emoji="💸"
        title="Log money"
      />,
    );

  // Finished things collapse into one quiet line
  const finished: string[] = [];
  if (workoutDone)
    finished.push(`Workout done (${gymDay.exercises.length} exercises)`);
  else if (gymDay.rest && hasPlan) finished.push("Rest day");
  if (habits.length > 0 && pendingHabits.length === 0)
    finished.push(
      `All ${habits.length} habit${habits.length === 1 ? "" : "s"} checked in`,
    );
  if (journalWritten) finished.push("Journal written");
  if (moneyLogged) finished.push("Money logged");

  // Something worth knowing, picked from the data
  const insights: string[] = [];

  let gymStreak = 0;
  for (let i = 0; i < 30; i++) {
    const date = addDays(today, -i);
    const did = (gymCheckins[date] ?? []).length > 0;
    if (did) gymStreak++;
    else if (date === today && gymDay.rest) continue; // rest days don't break the run
    else if (i === 0) continue; // today may still be ahead of you
    else break;
  }
  const sessionsIn = (offset: number) =>
    Array.from({ length: 7 }, (_, i) => addDays(today, -offset - i)).filter(
      (date) => (gymCheckins[date] ?? []).length > 0,
    ).length;
  const weekSessions = sessionsIn(0);
  const previousWeekSessions = sessionsIn(7);

  if (gymStreak >= 2)
    insights.push(`🔥 ${gymStreak} days in a row with a workout done.`);
  else if (weekSessions > 0)
    insights.push(
      `🏋️ ${weekSessions} workout${weekSessions === 1 ? "" : "s"} in the last 7 days${
        previousWeekSessions
          ? `, ${weekSessions > previousWeekSessions ? "up from" : weekSessions < previousWeekSessions ? "down from" : "same as"} ${previousWeekSessions} the week before`
          : ""
      }.`,
    );

  for (const habit of habits) {
    const own = habitCheckins.filter((c) => c.habit_id === habit.id);
    const run = streak(own, today);
    const lastWeek = own.filter(
      (c) => c.check_date >= addDays(today, -6) && c.done,
    ).length;
    if (run >= 3) {
      insights.push(`✅ ${habit.name}: ${run} days running.`);
    } else if (habit.count_label) {
      const counts = own
        .filter((c) => c.check_date >= addDays(today, -6) && c.count !== null)
        .map((c) => c.count as number);
      const before = own
        .filter(
          (c) =>
            c.check_date >= addDays(today, -13) &&
            c.check_date <= addDays(today, -7) &&
            c.count !== null,
        )
        .map((c) => c.count as number);
      const avg = (list: number[]) =>
        list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
      const now = avg(counts);
      const then = avg(before);
      if (now !== null && then !== null && Math.abs(now - then) >= 0.5)
        insights.push(
          `${now < then ? "📉" : "📈"} ${habit.name}: ${now.toFixed(1)} ${habit.count_label} a day this week, was ${then.toFixed(1)}.`,
        );
      else if (now !== null)
        insights.push(
          `${habit.name}: ${now.toFixed(1)} ${habit.count_label} a day this week.`,
        );
    } else if (lastWeek > 0) {
      insights.push(`${habit.name}: kept ${lastWeek} of the last 7 days.`);
    }
  }

  const daysSoFar = Number(today.slice(8));
  const spentThisMonth = totalsOf(transactions).expense;
  if (spentThisMonth > 0)
    insights.push(
      `💸 ${formatMoney(Math.round(spentThisMonth / daysSoFar))} a day on average in ${formatMonthShort(today.slice(0, 7))}${
        spentToday > 0
          ? `, ${formatMoney(spentToday)} today`
          : ", nothing logged today"
      }.`,
    );

  const weights = bodyLogs.filter((l) => l.weight_kg);
  if (weights.length > 1) {
    const change = weights[weights.length - 1].weight_kg - weights[0].weight_kg;
    if (Math.abs(change) >= 0.2)
      insights.push(
        `⚖️ Weight ${change < 0 ? "down" : "up"} ${Math.abs(change).toFixed(1)} kg this month.`,
      );
  }

  const moodValues = moods
    .map((m) => m.mood)
    .filter((m): m is number => m !== null);
  if (moodValues.length >= 3) {
    const avgMood =
      moodValues.reduce((a, b) => a + b, 0) / moodValues.length;
    insights.push(
      `🙂 Mood averaged ${avgMood.toFixed(1)} of 5 over the last ${moodValues.length} journalled days.`,
    );
  }

  if (plan.items.length > 0 && pendingPlan.length === 0)
    finished.push(`All ${plan.items.length} plan tasks done`);

  const allClear =
    reminders.length === 0 &&
    pendingExercises.length === 0 &&
    pendingHabits.length === 0 &&
    pendingPlan.length === 0;

  const dayTotal =
    (gymDay.rest ? 0 : gymDay.exercises.length) +
    habits.length +
    plan.items.length;
  const dayDone =
    (gymDay.rest ? 0 : doneIds.length) +
    (habits.length - pendingHabits.length) +
    (plan.items.length - pendingPlan.length);
  const dayPercent = dayTotal ? Math.round((dayDone / dayTotal) * 100) : 100;

  const GYM_LIMIT = 4;
  const gymShown = pendingExercises.slice(0, GYM_LIMIT);

  return (
    <PageShell title="Overview">
      <div className="flex flex-col gap-3">
        <Suspense fallback={<div className="h-12" />}>
          <AddEntry />
        </Suspense>

        {/* Today so far: ring, one insight, what's done */}
        <section className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3 text-ink">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--ember) ${Math.max(dayPercent, 1) * 3.6}deg, color-mix(in srgb, var(--ink) 18%, transparent) 0)`,
            }}
          >
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-paper text-[10px] font-bold">
              {dayPercent}%
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ember">
              {allClear ? "All done today 🎉" : "Today so far"}
            </p>
            <p className="truncate text-[13px]">
              {insights[0] ?? "Log something and your day starts filling in."}
            </p>
            {finished.length > 0 && (
              <p className="truncate text-xs text-ink/60">
                ✓ {finished.join(" · ")}
              </p>
            )}
          </div>
        </section>

        {reminders.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {reminders}
          </div>
        )}

        <TodayTasks
          date={today}
          goals={plan.goals}
          items={plan.items}
          goalCount={plan.goalCount}
          hideWhenDone
          limit={4}
        />

        {!hasPlan ? (
          <Link
            href="/health/body"
            className="flex min-h-11 items-center gap-3 rounded-[14px] border border-dashed border-paper/15 px-4 py-2.5 text-sm text-paper/60"
          >
            <span>🏋️</span>
            <span className="flex-1">No gym plan yet. Build your 4-week plan</span>
            <span className="text-ember">→</span>
          </Link>
        ) : (
          pendingExercises.length > 0 && (
            <>
              <SectionHead
                title={gymDay.title || "Workout"}
                href="/health/gym"
                link={`${doneIds.length}/${gymDay.exercises.length}`}
              />
              <GymChecklist
                exercises={gymShown}
                date={today}
                doneBefore={doneIds.length}
                week={
                  block ? blockWeek(block.start_date, today, block.weeks) : null
                }
              />
              {pendingExercises.length > GYM_LIMIT && (
                <Link href="/health/gym" className="-mt-1 text-xs font-semibold text-ember">
                  +{pendingExercises.length - GYM_LIMIT} more exercises →
                </Link>
              )}
            </>
          )
        )}

        {habits.length === 0 ? (
          <Empty href="/health/habits">No habits yet. Add one to track →</Empty>
        ) : (
          pendingHabits.length > 0 && (
            <>
              <SectionHead
                title="Habits"
                href="/health/habits"
                link={`${habits.length - pendingHabits.length}/${habits.length}`}
              />
              <ul className="overflow-hidden rounded-[18px] border border-paper/10 bg-surface">
                {pendingHabits.map((habit, i) => (
                  <HabitRow
                    key={habit.id}
                    habit={habit}
                    date={today}
                    checkin={null}
                    streak={streak(
                      habitCheckins.filter((c) => c.habit_id === habit.id),
                      today,
                    )}
                    first={i === 0}
                  />
                ))}
              </ul>
            </>
          )
        )}

        {/* Money in one row */}
        <Link
          href="/financial/daily"
          className="mt-1 grid grid-cols-4 divide-x divide-paper/[0.06] rounded-[18px] border border-paper/10 bg-surface py-2.5"
        >
          {[
            { label: "Today", value: formatMoney(spentToday) },
            {
              label: "Month",
              value: `${monthNet < 0 ? "−" : ""}${formatMoney(Math.abs(monthNet))}`,
              tone: monthNet < 0 ? "text-[#b3372e] dark:text-red-300" : "text-moss",
            },
            { label: "Savings", value: formatMoney(worth) },
            {
              label: "Owe",
              value: formatMoney(owe),
              tone: owe > 0 ? "text-[#b3372e] dark:text-red-300" : "",
            },
          ].map((f) => (
            <div key={f.label} className="min-w-0 px-2 text-center">
              <p className="truncate text-[11px] text-paper/50">{f.label}</p>
              <p className={`truncate text-sm font-bold tabular-nums ${f.tone ?? ""}`}>
                {f.value}
              </p>
            </div>
          ))}
        </Link>
        {topToday.length > 0 && (
          <p className="-mt-1 truncate px-1 text-xs text-paper/45">
            Top today: {topToday.map((c) => `${c.name} ${formatMoney(c.amount)}`).join(" · ")}
          </p>
        )}
      </div>
    </PageShell>
  );
}
