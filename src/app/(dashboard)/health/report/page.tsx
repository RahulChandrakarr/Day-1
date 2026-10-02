import PeriodNav from "@/components/finance/period-nav";
import { Card as Shell, CardGrid, CardHead, Stack } from "@/components/ui/kit";
import PdfLink from "@/components/settings/pdf-link";
import { addMonths, formatMonth, parseMonthParam } from "@/lib/finance";
import { reasonLabel } from "@/lib/health";
import { loadHealthReport } from "@/lib/health-report";
import type { ReactNode } from "react";

const pct = (value: number) => `${Math.round(value * 100)}%`;

export default async function ReportPage({
  searchParams,
}: PageProps<"/health/report">) {
  const month = parseMonthParam((await searchParams).month);
  const { today, previousMonth, habits, report, previous, changes, nothingYet } =
    await loadHealthReport(month);
  const growth = changes.filter((c) => c.good);
  const lows = changes.filter((c) => !c.good);

  return (
    <Stack>
      <PeriodNav
        label={formatMonth(month)}
        prevHref={`/health/report?month=${previousMonth}`}
        nextHref={`/health/report?month=${addMonths(month, 1)}`}
        currentHref="/health/report"
        isCurrent={month === today.slice(0, 7)}
        currentLabel="This month"
      >
        <PdfLink variant="icon" href={`/api/reports/health?month=${month}`} label="Download PDF" />
      </PeriodNav>

      {nothingYet ? (
        <p className="card px-6 py-12 text-center text-sm text-paper/50">
          Nothing tracked in {formatMonth(month)} yet. Tick off workouts and
          habits and the report fills in.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Workouts"
              value={`${report.gym.doneSessions}`}
              hint={`of ${report.gym.plannedSessions} planned`}
              delta={report.gym.doneSessions - previous.gym.doneSessions}
              suffix=" vs last month"
            />
            <Tile
              label="Habits kept"
              value={pct(report.habitRate)}
              hint={`${habits.length} habit${habits.length === 1 ? "" : "s"} tracked`}
              delta={Math.round((report.habitRate - previous.habitRate) * 100)}
              suffix="% vs last month"
            />
            <Tile
              label="Weight"
              value={report.body.end ? `${report.body.end.toFixed(1)} kg` : "—"}
              hint={
                report.body.change !== null
                  ? `${report.body.change > 0 ? "+" : ""}${report.body.change.toFixed(1)} kg this month`
                  : "No weigh-in yet"
              }
              delta={report.body.change !== null ? -report.body.change : null}
              suffix=""
              hideDelta
            />
            <Tile
              label="Mood"
              value={report.mood.avg ? `${report.mood.avg.toFixed(1)}/5` : "—"}
              hint={`${report.mood.entries} day${report.mood.entries === 1 ? "" : "s"} journalled`}
              delta={
                report.mood.avg !== null && previous.mood.avg !== null
                  ? Number((report.mood.avg - previous.mood.avg).toFixed(1))
                  : null
              }
              suffix=" vs last month"
            />
          </div>

          <CardGrid layout="triple">
            {(growth.length > 0 || lows.length > 0) && (
              <>
                <Card title="Growth 📈">
                  {growth.length ? (
                    <ChangeList items={growth} tone="good" />
                  ) : (
                    <Empty>Nothing clearly up on last month yet.</Empty>
                  )}
                </Card>
                <Card title="Slipping 📉">
                  {lows.length ? (
                    <ChangeList items={lows} tone="bad" />
                  ) : (
                    <Empty>Nothing went backwards. Good month.</Empty>
                  )}
                </Card>
              </>
            )}

            <Card title="Gym">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Bar
                  label="Sessions started"
                  value={report.gym.doneSessions}
                  total={report.gym.plannedSessions}
                  compare={`${previous.gym.doneSessions} last month`}
                />
                <div className="mt-3">
                  <Bar
                    label="Exercises ticked"
                    value={report.gym.doneExercises}
                    total={report.gym.plannedExercises}
                    compare={`${previous.gym.doneExercises} last month`}
                  />
                </div>
                <p className="mt-3 text-sm text-paper/55">
                  {report.gym.fullSessions} workout
                  {report.gym.fullSessions === 1 ? "" : "s"} finished completely
                  {report.gym.restDays > 0 &&
                    ` · ${report.gym.restDays} rest days`}
                  .
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-paper/45">
                  Where the work went
                </p>
                {report.gym.byMuscle.length ? (
                  <ul className="flex flex-col gap-2">
                    {report.gym.byMuscle.slice(0, 6).map((m) => (
                      <li key={m.muscle}>
                        <div className="flex justify-between text-sm">
                          <span className="truncate">{m.muscle}</span>
                          <span className="tabular-nums text-paper/55">
                            {m.count}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper/10">
                          <div
                            className="h-full rounded-full bg-ember"
                            style={{
                              width: `${(m.count / report.gym.byMuscle[0].count) * 100}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No exercises ticked off this month.</Empty>
                )}
              </div>
            </div>
          </Card>

          {report.habits.length > 0 && (
            <Card title="Habits">
              <ul className="flex flex-col gap-4">
                {report.habits.map((h) => {
                  const last = previous.habits.find(
                    (p) => p.habit.id === h.habit.id,
                  );
                  return (
                    <li key={h.habit.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{h.habit.name}</span>
                        <span className="text-sm text-paper/55">
                          {h.done} of {report.days} days
                          {last && ` · was ${last.done}/${previous.days}`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper/10">
                          <div
                            className="h-full rounded-full bg-moss"
                            style={{ width: `${Math.min(h.rate, 1) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-paper/55">
                          {pct(h.rate)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-paper/45">
                        {h.avgCount !== null && h.habit.count_label && (
                          <>
                            {h.avgCount.toFixed(1)} {h.habit.count_label} a day
                            {last?.avgCount != null &&
                              ` (was ${last.avgCount.toFixed(1)})`}
                            {" · "}
                          </>
                        )}
                        best streak {h.bestStreak} day
                        {h.bestStreak === 1 ? "" : "s"}
                        {h.topReason && ` · missed most often: ${reasonLabel(h.topReason).toLowerCase()}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card title="Body">
            {report.body.entries > 0 || report.body.start ? (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Start"
                  value={report.body.start ? `${report.body.start.toFixed(1)} kg` : "—"}
                />
                <Stat
                  label="Now"
                  value={report.body.end ? `${report.body.end.toFixed(1)} kg` : "—"}
                />
                <Stat
                  label="Change"
                  value={
                    report.body.change !== null
                      ? `${report.body.change > 0 ? "+" : ""}${report.body.change.toFixed(1)} kg`
                      : "—"
                  }
                  tone={
                    report.body.change === null
                      ? undefined
                      : report.body.change <= 0
                        ? "good"
                        : "warn"
                  }
                />
                <Stat
                  label="BMI"
                  value={report.body.bmi ? report.body.bmi.toFixed(1) : "—"}
                  hint={
                    report.body.waistChange !== null
                      ? `waist ${report.body.waistChange > 0 ? "+" : ""}${report.body.waistChange.toFixed(1)} cm`
                      : undefined
                  }
                />
              </dl>
            ) : (
              <Empty>No weigh-ins this month. Add one on the Body tab.</Empty>
            )}
            </Card>
          </CardGrid>
        </>
      )}
    </Stack>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Shell>
      <CardHead title={title} />
      {children}
    </Shell>
  );
}

function Tile({
  label,
  value,
  hint,
  delta,
  suffix,
  hideDelta,
}: {
  label: string;
  value: string;
  hint: string;
  delta: number | null;
  suffix: string;
  hideDelta?: boolean;
}) {
  const show = !hideDelta && delta !== null && delta !== 0;
  return (
    <div className="card p-4">
      <p className="truncate text-sm text-paper/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-paper/45">{hint}</p>
      {show && (
        <p
          className={`mt-1 text-xs font-medium ${
            delta! > 0 ? "text-moss" : "text-red-700 dark:text-red-300"
          }`}
        >
          {delta! > 0 ? "▲ +" : "▼ "}
          {delta}
          {suffix}
        </p>
      )}
    </div>
  );
}

function ChangeList({
  items,
  tone,
}: {
  items: { label: string; detail: string; direction: string }[];
  tone: "good" | "bad";
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2 text-sm">
          <span
            className={
              tone === "good"
                ? "text-moss"
                : "text-red-700 dark:text-red-300"
            }
          >
            {item.direction === "up" ? "▲" : "▼"}
          </span>
          <span className="min-w-0">
            <span className="font-medium">{item.label}</span>
            <span className="block text-xs text-paper/50">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Bar({
  label,
  value,
  total,
  compare,
}: {
  label: string;
  value: number;
  total: number;
  compare: string;
}) {
  const share = total ? Math.min(value / total, 1) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-paper/55">
          {value}/{total}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper/10">
        <div
          className="h-full rounded-full bg-ember"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-paper/45">{compare}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-paper/50">{label}</dt>
      <dd
        className={`truncate font-semibold tabular-nums ${
          tone === "good" ? "text-moss" : tone === "warn" ? "text-chart-expense" : ""
        }`}
      >
        {value}
      </dd>
      {hint && <dd className="truncate text-xs text-paper/40">{hint}</dd>}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="card py-6 text-center text-sm text-paper/40">
      {children}
    </p>
  );
}
