// Yearly goals → monthly → weekly → daily, and how progress rolls up.
// Weeks are fixed chunks of a month: days 1-7, 8-14, 15-21, 22-end.

import { addDays, daysInMonth } from "@/lib/finance";

export type PlanLevel = "month" | "week" | "day";

export type PlanGoal = {
  id: string;
  year: number;
  title: string;
  emoji: string;
  notes: string;
  target_value: number | null;
  unit: string | null;
  start_month: number; // 1-12
  end_month: number; // 1-12
  position: number;
};

export type PlanItem = {
  id: string;
  goal_id: string;
  level: PlanLevel;
  period: string;
  title: string;
  notes: string;
  target_value: number | null;
  done: boolean;
  position: number;
};

export type PlanProgress = {
  id: string;
  goal_id: string;
  logged_on: string;
  amount: number;
  note: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export const WEEKS = [1, 2, 3, 4] as const;

export const weekOfMonth = (date: string) =>
  Math.min(Math.floor((Number(date.slice(8)) - 1) / 7) + 1, 4);

export const weekPeriod = (month: string, week: number) => `${month}-w${week}`;

export function weekRange(month: string, week: number) {
  const startDay = (week - 1) * 7 + 1;
  const endDay = week === 4 ? daysInMonth(month) : week * 7;
  const pad = (d: number) => String(d).padStart(2, "0");
  return { from: `${month}-${pad(startDay)}`, to: `${month}-${pad(endDay)}` };
}

export function weekDays(month: string, week: number) {
  const { from, to } = weekRange(month, week);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

export const monthsOfYear = (year: number) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

// The months a goal runs in, e.g. 2026-03 … 2026-06
export const goalMonths = (goal: Pick<PlanGoal, "year" | "start_month" | "end_month">) =>
  monthsOfYear(goal.year).filter((m) => {
    const n = Number(m.slice(5));
    return n >= goal.start_month && n <= goal.end_month;
  });

export const goalActiveIn = (
  goal: Pick<PlanGoal, "year" | "start_month" | "end_month">,
  month: string,
) => goalMonths(goal).includes(month);

export function goalRange(goal: Pick<PlanGoal, "year" | "start_month" | "end_month">) {
  const end = monthKey(goal.year, goal.end_month);
  return {
    from: `${monthKey(goal.year, goal.start_month)}-01`,
    to: `${end}-${String(daysInMonth(end)).padStart(2, "0")}`,
  };
}

// Share of the goal's own time that has passed (0..1)
export function goalElapsed(
  goal: Pick<PlanGoal, "year" | "start_month" | "end_month">,
  today: string,
) {
  const { from, to } = goalRange(goal);
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 86_400_000;
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.min(Math.max((now - start) / (end - start), 0), 1);
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Which items fall inside a month / week / day
export function itemsIn(
  items: PlanItem[],
  scope: { month?: string; week?: number; day?: string },
) {
  return items.filter((item) => {
    if (scope.day) return item.level === "day" && item.period === scope.day;
    if (scope.month && scope.week) {
      const { from, to } = weekRange(scope.month, scope.week);
      return (
        (item.level === "week" &&
          item.period === weekPeriod(scope.month, scope.week)) ||
        (item.level === "day" && item.period >= from && item.period <= to)
      );
    }
    if (scope.month)
      return item.period.startsWith(scope.month);
    return true;
  });
}

export function progressIn(
  logs: PlanProgress[],
  range: { from: string; to: string },
) {
  return logs
    .filter((l) => l.logged_on >= range.from && l.logged_on <= range.to)
    .reduce((sum, l) => sum + l.amount, 0);
}

export type Progress = {
  ratio: number | null; // 0..1, null when there is nothing to measure yet
  done: number; // ticked items
  total: number; // all items
  amount: number | null; // logged toward the number
  target: number | null; // number for this period
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

// Progress for one goal over a year, month, week or day.
// With a number target it follows the logged amounts; otherwise ticked items.
export function goalProgress(
  goal: PlanGoal,
  items: PlanItem[],
  logs: PlanProgress[],
  scope: { month?: string; week?: number; day?: string } = {},
): Progress {
  const own = items.filter((i) => i.goal_id === goal.id);
  const scoped = itemsIn(own, scope);
  const done = scoped.filter((i) => i.done).length;
  const total = scoped.length;

  if (goal.target_value) {
    const range = scope.day
      ? { from: scope.day, to: scope.day }
      : scope.month && scope.week
        ? weekRange(scope.month, scope.week)
        : scope.month
          ? { from: `${scope.month}-01`, to: `${scope.month}-${String(daysInMonth(scope.month)).padStart(2, "0")}` }
          : goalRange(goal);
    const amount = progressIn(
      logs.filter((l) => l.goal_id === goal.id),
      range,
    );
    const target = periodTarget(goal, own, scope);
    return {
      ratio: target ? clamp(amount / target) : total ? done / total : null,
      done,
      total,
      amount,
      target,
    };
  }

  return {
    ratio: total ? done / total : null,
    done,
    total,
    amount: null,
    target: null,
  };
}

// The number a goal should reach in a period: what the plan says, or an even share
export function periodTarget(
  goal: PlanGoal,
  items: PlanItem[],
  scope: { month?: string; week?: number; day?: string },
) {
  if (!goal.target_value) return null;
  if (!scope.month && !scope.day) return goal.target_value;
  const month = scope.month ?? scope.day!.slice(0, 7);
  const monthItems = items.filter(
    (i) => i.level === "month" && i.period === month && i.target_value !== null,
  );
  const monthTarget = monthItems.length
    ? monthItems.reduce((sum, i) => sum + (i.target_value ?? 0), 0)
    : goalActiveIn(goal, month)
      ? goal.target_value / goalMonths(goal).length
      : 0;
  if (!scope.week && !scope.day) return monthTarget;
  const week = scope.week ?? weekOfMonth(scope.day!);
  const weekItems = items.filter(
    (i) =>
      i.level === "week" &&
      i.period === weekPeriod(month, week) &&
      i.target_value !== null,
  );
  const weekTarget = weekItems.length
    ? weekItems.reduce((sum, i) => sum + (i.target_value ?? 0), 0)
    : monthTarget / 4;
  if (!scope.day) return weekTarget;
  return weekTarget / weekDays(month, week).length;
}

export function formatAmount(value: number, unit: string | null) {
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (!unit) return text;
  return unit === "₹" ? `₹${text}` : `${text} ${unit}`;
}

// Even split of what's left over the remaining months of the year
export function splitAcrossMonths(
  goal: PlanGoal,
  logged: number,
  fromMonth: string,
) {
  const months = goalMonths(goal).filter((m) => m >= fromMonth);
  const remaining = Math.max((goal.target_value ?? 0) - logged, 0);
  const share = months.length ? remaining / months.length : 0;
  return months.map((month) => ({
    month,
    target: Math.round(share * 100) / 100,
  }));
}
