import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import PageShell from "@/components/dashboard/page-shell";
import AddEntry from "@/components/finance/add-entry";
import GymTracker from "@/components/health/gym-tracker";
import HabitCard from "@/components/health/habit-card";
import { personBalances } from "@/lib/debts";
import {
  addDays,
  categoryBreakdown,
  formatMoney,
  monthRange,
  todayISO,
  totalsOf,
} from "@/lib/finance";
import {
  getAccounts,
  getDebts,
  getInvestmentEntries,
  getPeople,
  getTransactions,
} from "@/lib/finance-queries";
import { fullWeek, isoWeekday, streak } from "@/lib/health";
import {
  getGymCheckins,
  getGymPlan,
  getHabitCheckins,
} from "@/lib/health-queries";
import { accountSummaries } from "@/lib/investments";
import { getHabits, getJournalDays } from "@/lib/journal-queries";

export const metadata: Metadata = {
  title: "Overview · Day One",
};

export default async function OverviewPage() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const range = monthRange(month);

  const [
    transactions,
    people,
    debts,
    accounts,
    investments,
    journalToday,
    plan,
    gymCheckins,
    habits,
    habitCheckins,
  ] = await Promise.all([
    getTransactions({ from: range.from, to: today }),
    getPeople(),
    getDebts(),
    getAccounts(),
    getInvestmentEntries(),
    getJournalDays(today, today),
    getGymPlan(),
    getGymCheckins(today, today),
    getHabits(),
    getHabitCheckins(addDays(today, -60), today),
  ]);

  // Money, kept short
  const todayTx = transactions.filter((t) => t.occurred_on === today);
  const spentToday = totalsOf(todayTx).expense;
  const topToday = categoryBreakdown(todayTx, "expense").slice(0, 3);
  const monthNet = totalsOf(transactions).net;
  const worth = accountSummaries(accounts, investments).reduce(
    (sum, a) => sum + a.current,
    0,
  );
  const owe = personBalances(people, debts).reduce((sum, p) => sum + p.owe, 0);

  // Gym
  const week = fullWeek(plan);
  const gymDay = week[isoWeekday(today) - 1];
  const hasPlan = week.some((d) => d.rest || d.exercises.length > 0);
  const doneIds = gymCheckins[today] ?? [];
  const workoutLeft =
    !gymDay.rest &&
    gymDay.exercises.some((e) => !doneIds.includes(e.id));

  // Habits
  const unchecked = habits.filter(
    (h) => !habitCheckins.some((c) => c.habit_id === h.id && c.check_date === today),
  );

  const reminders: ReactNode[] = [];
  if (journalToday.length === 0)
    reminders.push(
      <Reminder key="journal" href="/daily" emoji="📝" title="Write today's journal" />,
    );
  if (habits.length > 0 && unchecked.length > 0)
    reminders.push(
      <Reminder
        key="habits"
        href="/health/habits"
        emoji="✅"
        title={`Check in ${unchecked.length} habit${unchecked.length === 1 ? "" : "s"}`}
      />,
    );
  if (workoutLeft && doneIds.length === 0)
    reminders.push(
      <Reminder
        key="gym"
        href="/health/gym"
        emoji="🏋️"
        title={`${gymDay.title || "Workout"} is planned today`}
      />,
    );
  if (todayTx.length === 0)
    reminders.push(
      <Reminder key="money" href="/financial/daily" emoji="💸" title="Nothing spent or earned logged today" />,
    );

  return (
    <PageShell title="Overview" description="Your life at a glance.">
      <Suspense fallback={<div className="h-12" />}>
        <AddEntry />
      </Suspense>

      {reminders.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">{reminders}</div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Card
          title={gymDay.rest ? "Rest day" : gymDay.title ? `Today · ${gymDay.title}` : "Today's workout"}
          link={{ href: "/health/gym", label: hasPlan ? "Gym" : "Plan week" }}
        >
          {hasPlan ? (
            <GymTracker day={gymDay} date={today} doneIds={doneIds} compact />
          ) : (
            <Empty href="/health/gym">No gym plan yet. Plan your week →</Empty>
          )}
        </Card>

        <Card title="Habits today" link={{ href: "/health/habits", label: "All habits" }}>
          {habits.length > 0 ? (
            <div className="flex flex-col gap-2">
              {habits.map((habit) => {
                const own = habitCheckins.filter((c) => c.habit_id === habit.id);
                return (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    date={today}
                    checkin={own.find((c) => c.check_date === today) ?? null}
                    history={[]}
                    streak={streak(own, today)}
                    compact
                  />
                );
              })}
            </div>
          ) : (
            <Empty href="/health/habits">No habits yet. Add one to track →</Empty>
          )}
        </Card>
      </div>

      <Card title="Money" link={{ href: "/financial/daily", label: "Finance" }}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Figure label="Spent today" value={formatMoney(spentToday)} />
          <Figure
            label="Net this month"
            value={`${monthNet < 0 ? "−" : ""}${formatMoney(Math.abs(monthNet))}`}
            tone={monthNet < 0 ? "bad" : "good"}
          />
          <Figure label="Savings" value={formatMoney(worth)} />
          <Figure label="You owe" value={formatMoney(owe)} tone={owe > 0 ? "bad" : undefined} />
        </div>
        {topToday.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-paper/10 pt-3">
            <span className="text-xs text-paper/45">Today&apos;s top spends</span>
            {topToday.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1.5 rounded-full border border-paper/10 px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: `var(--cat-${c.color})` }}
                />
                {c.name} · {formatMoney(c.amount)}
              </span>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function Card({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-paper/10 bg-surface/60 p-4 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="truncate font-serif text-xl sm:text-2xl">{title}</h2>
        {link && (
          <Link
            href={link.href}
            className="shrink-0 text-sm text-ember hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-paper/50">{label}</p>
      <p
        className={`truncate text-lg font-semibold tabular-nums sm:text-xl ${
          tone === "bad"
            ? "text-red-700 dark:text-red-300"
            : tone === "good"
              ? "text-moss"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Reminder({
  href,
  emoji,
  title,
}: {
  href: string;
  emoji: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-ember/30 bg-ember/10 px-3 py-2.5 transition hover:border-ember/60"
    >
      <span className="text-lg">{emoji}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      <span className="text-sm text-ember transition group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function Empty({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-dashed border-paper/15 py-8 text-center text-sm text-paper/55 transition hover:border-ember/50 hover:text-paper"
    >
      {children}
    </Link>
  );
}
