import "server-only";
import { addMonths, monthRange, todayISO } from "@/lib/finance";
import {
  getAllPlanDays,
  getBlocks,
  getBodyLogsBetween,
  getBodyProfile,
  getGymCheckins,
  getHabitCheckins,
  getMoodLogs,
} from "@/lib/health-queries";
import { getHabits } from "@/lib/journal-queries";
import { buildMonthReport, compareMonths } from "@/lib/reports";

// One month's health report and the month before, for the page and the PDF.
export async function loadHealthReport(month: string) {
  const today = todayISO();
  const previousMonth = addMonths(month, -1);
  const range = monthRange(month);
  const previousRange = monthRange(previousMonth);

  const [
    planByBlock,
    blocks,
    gymCheckins,
    habits,
    habitCheckins,
    bodyLogs,
    earlierLogs,
    moods,
    profile,
  ] = await Promise.all([
    getAllPlanDays(),
    getBlocks(),
    getGymCheckins(previousRange.from, range.to),
    getHabits(),
    getHabitCheckins(previousRange.from, range.to),
    getBodyLogsBetween(range.from, range.to),
    getBodyLogsBetween(previousRange.from, previousRange.to),
    getMoodLogs(previousRange.from, range.to),
    getBodyProfile(),
  ]);

  const shared = {
    today,
    planByBlock,
    blocks,
    gymCheckins,
    habits,
    habitCheckins,
    moods,
    heightCm: profile?.height_cm ?? null,
  };
  const report = buildMonthReport({
    ...shared,
    month,
    bodyLogs,
    previousWeight: earlierLogs[earlierLogs.length - 1]?.weight_kg ?? null,
  });
  const previous = buildMonthReport({
    ...shared,
    month: previousMonth,
    bodyLogs: earlierLogs,
    previousWeight: null,
  });
  const changes = compareMonths(report, previous);
  const nothingYet =
    report.gym.doneSessions === 0 &&
    report.habits.every((h) => h.tracked === 0) &&
    report.body.entries === 0;

  return { today, previousMonth, habits, report, previous, changes, nothingYet };
}
