import "server-only";
import { formatMonth, todayISO } from "@/lib/finance";
import { getNotes, getPlanYear } from "@/lib/plan-queries";
import {
  formatAmount,
  goalActiveIn,
  goalElapsed,
  goalProgress,
  MONTH_NAMES,
  WEEKS,
  type PlanItem,
} from "@/lib/plans";
import { ReportDoc, percent, type Cell } from "./report";

const levelLabel = (item: PlanItem) => {
  if (item.level === "month") return formatMonth(item.period);
  if (item.level === "week") return `Week ${item.period.slice(-1)}, ${formatMonth(item.period.slice(0, 7))}`;
  return item.period.slice(8, 10) + " " + formatMonth(item.period.slice(0, 7));
};

export async function planReport(period: { month: string } | { year: number }) {
  const isMonth = "month" in period;
  const year = isMonth ? Number(period.month.slice(0, 4)) : period.year;
  const [{ goals: allGoals, items, logs }, notes] = await Promise.all([
    getPlanYear(year),
    getNotes(),
  ]);
  const goals = isMonth ? allGoals.filter((g) => goalActiveIn(g, period.month)) : allGoals;
  const scope = isMonth ? { month: period.month } : {};

  const pdf = await ReportDoc.create("Plan report", isMonth ? formatMonth(period.month) : `${year}`);

  const scopedItems = items.filter(
    (i) => goals.some((g) => g.id === i.goal_id) && (!isMonth || i.period.startsWith(period.month)),
  );
  const ratios = goals
    .map((g) => goalProgress(g, items, logs, scope).ratio)
    .filter((r): r is number => r !== null);
  pdf.stats([
    { label: "Goals", value: `${goals.length}` },
    {
      label: "Average progress",
      value: ratios.length ? percent(ratios.reduce((a, b) => a + b, 0) / ratios.length) : "–",
    },
    {
      label: "Tasks done",
      value: `${scopedItems.filter((i) => i.done).length} / ${scopedItems.length}`,
    },
    {
      label: "Still to do",
      value: `${scopedItems.filter((i) => !i.done).length}`,
    },
  ]);

  if (goals.length === 0) pdf.empty(isMonth ? "No goals run in this month." : "No goals for this year yet.");

  for (const goal of goals) {
    const progress = goalProgress(goal, items, logs, scope);
    const range = `${MONTH_NAMES[goal.start_month - 1]} – ${MONTH_NAMES[goal.end_month - 1]} ${goal.year}`;
    pdf.heading(goal.title, range);

    const measured =
      progress.target !== null
        ? `${formatAmount(progress.amount ?? 0, goal.unit)} of ${formatAmount(progress.target, goal.unit)}`
        : `${progress.done} of ${progress.total} tasks`;
    const elapsed = isMonth ? null : goalElapsed(goal, todayISO());
    const behind = elapsed !== null && progress.ratio !== null && progress.ratio + 0.05 < elapsed;
    pdf.bar(
      isMonth ? "This month" : "Whole goal",
      progress.ratio,
      `${percent(progress.ratio)} · ${measured}`,
      behind ? "bad" : undefined,
    );
    if (behind) pdf.muted(`Behind: ${percent(elapsed)} of the time has passed.`);
    if (goal.notes.trim()) pdf.muted(goal.notes.trim());

    // Month / week breakdown
    if (isMonth) {
      const weekRows: Cell[][] = WEEKS.map((week) => {
        const w = goalProgress(goal, items, logs, { month: period.month, week });
        return [
          `Week ${week}`,
          w.target !== null
            ? `${formatAmount(w.amount ?? 0, goal.unit)} / ${formatAmount(w.target, goal.unit)}`
            : `${w.done} / ${w.total} tasks`,
          percent(w.ratio),
        ];
      });
      pdf.space(4);
      pdf.table(
        [
          { label: "Week", width: 1.4 },
          { label: "Progress", width: 3 },
          { label: "%", width: 0.8, align: "right" },
        ],
        weekRows,
      );
    } else {
      const months = Array.from(
        { length: goal.end_month - goal.start_month + 1 },
        (_, i) => `${goal.year}-${String(goal.start_month + i).padStart(2, "0")}`,
      );
      pdf.space(4);
      pdf.table(
        [
          { label: "Month", width: 1.6 },
          { label: "Progress", width: 3 },
          { label: "%", width: 0.8, align: "right" },
        ],
        months.map((month) => {
          const m = goalProgress(goal, items, logs, { month });
          return [
            formatMonth(month),
            m.target !== null
              ? `${formatAmount(m.amount ?? 0, goal.unit)} / ${formatAmount(m.target, goal.unit)}`
              : `${m.done} / ${m.total} tasks`,
            percent(m.ratio),
          ];
        }),
      );
    }

    const own = scopedItems
      .filter((i) => i.goal_id === goal.id)
      .sort((a, b) => a.period.localeCompare(b.period) || a.position - b.position);
    if (own.length > 0) {
      pdf.subheading("Tasks", `${own.filter((i) => i.done).length} of ${own.length} done`);
      pdf.table(
        [
          { label: "", width: 0.35 },
          { label: "Task", width: 3.4 },
          { label: "When", width: 1.8 },
        ],
        own.map((item) => [
          { text: item.done ? "✓" : "○", tone: item.done ? "good" : undefined },
          item.target_value !== null
            ? `${item.title} (${formatAmount(item.target_value, goal.unit)})`
            : item.title,
          levelLabel(item),
        ]),
        { size: 9 },
      );
    }
  }

  const pinned = notes.filter((n) => n.pinned);
  if (pinned.length > 0) {
    pdf.heading("Pinned notes");
    for (const note of pinned) {
      if (note.title) pdf.text(note.title, { bold: true });
      if (note.body.trim()) pdf.text(note.body.trim().slice(0, 3000), { indent: 8 });
      pdf.space(4);
    }
  }

  return pdf.save();
}
