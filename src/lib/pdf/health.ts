import "server-only";
import { formatMonth } from "@/lib/finance";
import { reasonLabel } from "@/lib/health";
import { loadHealthReport } from "@/lib/health-report";
import { ReportDoc, percent } from "./report";

const kg = (value: number | null) => (value === null ? "–" : `${value.toFixed(1)} kg`);
const change = (value: number | null, unit: string) =>
  value === null ? "–" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)} ${unit}`;

export async function healthReport(month: string) {
  const { report, previous, changes, nothingYet } = await loadHealthReport(month);
  const pdf = await ReportDoc.create("Health report", `${formatMonth(month)} · compared with ${formatMonth(previous.month)}`);

  if (nothingYet) {
    pdf.empty("Nothing tracked this month yet.");
    return pdf.save();
  }

  pdf.stats([
    {
      label: "Workouts",
      value: `${report.gym.doneSessions} / ${report.gym.plannedSessions}`,
      hint: `last month ${previous.gym.doneSessions}`,
    },
    {
      label: "Habits kept",
      value: percent(report.habitRate),
      hint: `last month ${percent(previous.habitRate)}`,
    },
    {
      label: "Weight",
      value: kg(report.body.end),
      hint: report.body.change === null ? "no change logged" : `${change(report.body.change, "kg")} this month`,
      tone: report.body.change === null ? undefined : undefined,
    },
    {
      label: "Mood",
      value: report.mood.avg === null ? "–" : `${report.mood.avg.toFixed(1)} / 5`,
      hint: report.mood.energy === null ? undefined : `energy ${report.mood.energy.toFixed(1)} / 5`,
    },
  ]);

  if (changes.length > 0) {
    pdf.heading("What changed");
    pdf.table(
      [
        { label: "", width: 0.4 },
        { label: "Change", width: 2 },
        { label: "Detail", width: 3.4 },
      ],
      changes.map((c) => [
        { text: c.good ? "▲" : "▼", tone: c.good ? "good" : "bad" },
        { text: c.label, bold: true },
        c.detail,
      ]),
    );
  }

  pdf.heading("Gym", `${report.days} days so far`);
  pdf.bar("Planned sessions started", report.gym.adherence, percent(report.gym.adherence));
  pdf.space(4);
  pdf.table(
    [
      { label: "", width: 2.4 },
      { label: "This month", width: 1.2, align: "right" },
      { label: "Last month", width: 1.2, align: "right" },
    ],
    [
      ["Sessions done", `${report.gym.doneSessions}`, `${previous.gym.doneSessions}`],
      ["Full sessions", `${report.gym.fullSessions}`, `${previous.gym.fullSessions}`],
      ["Exercises done", `${report.gym.doneExercises} / ${report.gym.plannedExercises}`, `${previous.gym.doneExercises}`],
      ["Rest days", `${report.gym.restDays}`, `${previous.gym.restDays}`],
    ],
  );
  if (report.gym.byMuscle.length > 0) {
    pdf.subheading("Exercises by muscle");
    pdf.table(
      [
        { label: "Muscle", width: 3 },
        { label: "Exercises", width: 1, align: "right" },
      ],
      report.gym.byMuscle.map((m) => [m.muscle, `${m.count}`]),
    );
  }

  if (report.habits.length > 0) {
    pdf.heading("Habits");
    pdf.table(
      [
        { label: "Habit", width: 2 },
        { label: "Kept", width: 0.7, align: "right" },
        { label: "Missed", width: 0.8, align: "right" },
        { label: "Rate", width: 0.7, align: "right" },
        { label: "Best run", width: 0.9, align: "right" },
        { label: "Average", width: 1.9, align: "right" },
        { label: "Main reason missed", width: 1.9 },
      ],
      report.habits.map((h) => [
        { text: h.habit.name, bold: true },
        `${h.done}`,
        `${h.missed}`,
        { text: percent(h.rate), tone: h.rate >= 0.7 ? "good" : h.rate < 0.4 ? "bad" : undefined },
        `${h.bestStreak} d`,
        h.avgCount === null ? "–" : `${h.avgCount.toFixed(1)} ${h.habit.count_label ?? ""}/day`,
        h.topReason ? reasonLabel(h.topReason) : "–",
      ]),
      { size: 9 },
    );
  }

  pdf.heading("Body");
  pdf.table(
    [
      { label: "", width: 2.4 },
      { label: "Value", width: 1.6, align: "right" },
    ],
    [
      ["Start of month", kg(report.body.start)],
      ["Latest", kg(report.body.end)],
      ["Weight change", change(report.body.change, "kg")],
      ["Waist change", change(report.body.waistChange, "cm")],
      ["BMI", report.body.bmi === null ? "–" : report.body.bmi.toFixed(1)],
      ["Measurements logged", `${report.body.entries}`],
    ],
  );

  return pdf.save();
}
