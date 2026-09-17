import "server-only";
import { tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addHabit } from "@/app/(dashboard)/daily/actions";
import {
  saveBodyProfile,
  saveHabitCheckin,
  setExerciseDone,
} from "@/app/(dashboard)/health/actions";
import { addDays } from "@/lib/finance";
import {
  ACTIVITIES,
  blockWeek,
  bmi,
  bmiBand,
  bmr,
  GOALS,
  idealWeightRange,
  nutritionTargets,
  tdee,
  type BodyProfile,
} from "@/lib/fitness";
import {
  exerciseTarget,
  isoWeekday,
  reasonLabel,
  REASONS,
  streak,
  WEEKDAYS,
} from "@/lib/health";
import {
  getBodyLogs,
  getBodyProfile,
  getCurrentBlock,
  getGymCheckins,
  getGymPlan,
  getHabitCheckins,
} from "@/lib/health-queries";
import { getHabits } from "@/lib/journal-queries";
import { changed, dateInput, failed, pick, type Domain } from "./common";

const DEFAULT_BODY: BodyProfile = {
  sex: "male",
  age: null,
  height_cm: null,
  activity: "moderate",
  goal: "maintain",
  experience: "beginner",
  days_per_week: 4,
  equipment: "full_gym",
  session_minutes: 60,
};

// The workout for a date, with what's been ticked.
export async function gymDay(date: string) {
  const block = await getCurrentBlock();
  const [week, checkins, recent] = await Promise.all([
    getGymPlan(block?.id ?? null),
    getGymCheckins(date, date),
    getGymCheckins(addDays(date, -6), date),
  ]);
  const day = week.find((d) => d.weekday === isoWeekday(date));
  const done = new Set(checkins[date] ?? []);
  return {
    date,
    weekday: WEEKDAYS[isoWeekday(date) - 1].label,
    block: block
      ? {
          name: block.name,
          split: block.split,
          goal: block.goal,
          week: blockWeek(block.start_date, date, block.weeks),
        }
      : null,
    day: day
      ? {
          title: day.title,
          rest: day.rest,
          exercises: day.rest
            ? []
            : day.exercises.map((e) => ({
                id: e.id,
                name: e.name,
                phase: e.phase ?? "main",
                muscle: e.muscle ?? null,
                target: exerciseTarget(e),
                restSeconds: e.rest_seconds ?? null,
                note: e.note,
                done: done.has(e.id),
              })),
        }
      : null,
    weekPlan: week.map((d) => ({
      weekday: WEEKDAYS[d.weekday - 1]?.label,
      title: d.rest ? "Rest" : d.title,
      exercises: d.exercises.length,
    })),
    workoutsInLast7Days: Object.values(recent).filter((ids) => ids.length > 0).length,
  };
}

export async function habitsSummary(from: string, to: string, today: string) {
  const [habits, checkins] = await Promise.all([
    getHabits(),
    getHabitCheckins(addDays(from, -60), to),
  ]);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return habits.map((h) => {
    const own = checkins.filter((c) => c.habit_id === h.id);
    const inRange = own.filter((c) => c.check_date >= from && c.check_date <= to);
    const counts = inRange.map((c) => c.count).filter((n): n is number => n !== null);
    const reasons = new Map<string, number>();
    for (const c of inRange)
      if (c.reason) reasons.set(c.reason, (reasons.get(c.reason) ?? 0) + 1);
    const todayCheck = own.find((c) => c.check_date === today);
    return {
      name: h.name,
      kind: h.kind === "quit" ? "quit (avoid it)" : "build (do it)",
      countLabel: h.count_label,
      dailyLimit: h.daily_limit,
      daysInRange: days,
      kept: inRange.filter((c) => c.done).length,
      missed: inRange.filter((c) => !c.done).length,
      notCheckedIn: days - inRange.length,
      currentStreak: streak(own, today),
      averageCount: counts.length
        ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10
        : null,
      topReasons: [...reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r, n]) => `${reasonLabel(r)} (${n})`),
      today: todayCheck
        ? { status: todayCheck.done ? "done" : "missed", count: todayCheck.count }
        : "not checked in",
    };
  });
}

export const health: Domain = {
  labels: {
    get_gym: "Checking your workout…",
    get_habits: "Checking your habits…",
    get_body: "Looking at your body stats…",
    tick_exercise: "Ticking off exercises…",
    check_in_habit: "Checking in your habit…",
    add_habit: "Adding the habit…",
    log_weight: "Logging your weight…",
    update_body_details: "Updating your body details…",
  },
  prompt: `HEALTH (gym, habits, body)
- The gym runs in 4-week blocks (the last week is a deload). Each weekday has a plan day (title, exercises with sets × reps, or rest). Ticking an exercise marks it done for that date.
- Habits are "build" (do it daily) or "quit" (avoid it, e.g. smoking). For quit habits, done = stayed clean / under the limit; some habits count something per day (e.g. cigarettes) with a daily limit. Missed check-ins can carry a reason.
- For "I smoked 3 today" on a quit habit with a counter: check in with count 3 and done = (count <= dailyLimit) when there's a limit, otherwise done = false.
- Reasons (use these values): ${REASONS.map((r) => r.value).join(", ")}.
- Body: BMI, maintenance calories (TDEE) and macro targets come from get_body. Activities: ${ACTIVITIES.map((a) => a.value).join(", ")}. Goals: ${GOALS.map((g) => g.value).join(", ")}.`,
  tools: (ctx) => ({
    get_gym: tool({
      description:
        "The workout for a date: block and week (with coaching advice), the day's exercises with targets and done/pending, the week's split, and workouts in the last 7 days.",
      inputSchema: z.object({ date: dateInput }),
      execute: async ({ date }) => gymDay(date),
    }),

    get_habits: tool({
      description:
        "Each habit over a date range: kept/missed/not checked in, current streak, average count, top reasons for missing, and today's status.",
      inputSchema: z.object({ from: dateInput, to: dateInput }),
      execute: async ({ from, to }) => {
        if (to < from) return failed("'to' is before 'from'.");
        return { from, to, habits: await habitsSummary(from, to, ctx.today) };
      },
    }),

    get_body: tool({
      description:
        "Body details (sex, age, height, activity, goal), latest weight, BMI, healthy weight range, maintenance calories, macro targets and the weight trend.",
      inputSchema: z.object({}),
      execute: async () => {
        const [profile, logs] = await Promise.all([getBodyProfile(), getBodyLogs(30)]);
        const latest = logs[logs.length - 1] ?? null;
        const weight = latest?.weight_kg ?? null;
        const bmiValue = weight && profile?.height_cm ? bmi(weight, profile.height_cm) : null;
        const resting =
          weight && profile ? bmr({ ...profile, weight_kg: weight }) : null;
        const maintenance = resting && profile ? Math.round(tdee(resting, profile.activity)) : null;
        return {
          details: profile,
          latestWeight: latest ? { kg: weight, on: latest.logged_on, waistCm: latest.waist_cm } : null,
          bmi: bmiValue ? { value: Math.round(bmiValue * 10) / 10, band: bmiBand(bmiValue) } : null,
          healthyWeightKg: profile?.height_cm
            ? (({ min, max }) => ({ min: Math.round(min), max: Math.round(max) }))(
                idealWeightRange(profile.height_cm),
              )
            : null,
          maintenanceCalories: maintenance,
          targets:
            maintenance && profile && weight
              ? nutritionTargets(maintenance, profile.goal, weight)
              : null,
          weightTrend: logs.slice(-12).map((l) => ({ on: l.logged_on, kg: l.weight_kg })),
        };
      },
    }),

    tick_exercise: tool({
      description:
        "Mark exercises done (or not) for a date, by name. Use names ['all'] to tick the whole workout.",
      inputSchema: z.object({
        names: z.array(z.string().min(1)).min(1).max(20),
        date: dateInput,
        done: z.boolean().default(true),
      }),
      execute: async ({ names, date, done }) => {
        const { day } = await gymDay(date);
        if (!day || day.rest || !day.exercises.length)
          return failed(`No workout planned for ${date}${day?.rest ? " (rest day)" : ""}.`);
        const targets = names.some((n) => n.toLowerCase() === "all")
          ? day.exercises
          : [];
        const missing: string[] = [];
        if (!targets.length)
          for (const name of names) {
            const found = pick(day.exercises, name, (e) => e.name);
            if ("error" in found) missing.push(found.error);
            else targets.push(found.item);
          }
        for (const e of targets) {
          const result = await setExerciseDone(e.id, date, done);
          if (!result.ok) return failed(result.error);
        }
        if (!targets.length) return failed(missing.join(" "));
        const total = day.exercises.length;
        const nowDone = new Set(day.exercises.filter((e) => e.done).map((e) => e.id));
        for (const e of targets) {
          if (done) nowDone.add(e.id);
          else nowDone.delete(e.id);
        }
        return changed(
          ctx,
          `${done ? "Ticked" : "Unticked"} ${targets.map((e) => e.name).join(", ")} for ${date}. ${nowDone.size}/${total} exercises done.`,
          { notFound: missing },
        );
      },
    }),

    check_in_habit: tool({
      description: "Check in a habit for a date: done or missed, with an optional count, reason and note.",
      inputSchema: z.object({
        habit: z.string().min(1),
        date: dateInput,
        done: z.boolean(),
        count: z.number().int().min(0).max(1000).optional(),
        reason: z.enum(REASONS.map((r) => r.value) as [string, ...string[]]).optional(),
        note: z.string().max(300).optional(),
      }),
      execute: async ({ habit, date, done, count, reason, note }) => {
        const found = pick(await getHabits(), habit, (h) => h.name);
        if ("error" in found) return failed(found.error);
        const result = await saveHabitCheckin({
          habitId: found.item.id,
          date,
          done,
          count: count ?? null,
          reason: done ? null : (reason ?? null),
          note: note ?? "",
        });
        if (!result.ok) return failed(result.error);
        return changed(
          ctx,
          `${found.item.name} on ${date}: ${done ? "done" : "missed"}${count !== undefined ? `, ${count} ${found.item.count_label ?? ""}` : ""}.`,
        );
      },
    }),

    add_habit: tool({
      description: "Start tracking a new habit.",
      inputSchema: z.object({
        name: z.string().min(1).max(40),
        kind: z.enum(["build", "quit"]),
        countLabel: z.string().max(20).optional().describe("What to count per day, e.g. cigarettes, glasses"),
        dailyLimit: z.number().int().min(0).max(1000).optional(),
      }),
      execute: async ({ name, kind, countLabel, dailyLimit }) => {
        const result = await addHabit(name, {
          kind,
          count_label: countLabel ?? null,
          daily_limit: dailyLimit ?? null,
        });
        if (!result.ok) return failed(result.error);
        return changed(ctx, `Now tracking "${name}" (${kind}).`);
      },
    }),

    log_weight: tool({
      description: "Log body weight (and optionally waist) for a date.",
      inputSchema: z.object({
        weightKg: z.number().min(25).max(400),
        date: dateInput,
        waistCm: z.number().min(40).max(250).optional(),
      }),
      execute: async ({ weightKg, date, waistCm }) => {
        const profile = await getBodyProfile();
        if (profile) {
          const result = await saveBodyProfile({
            profile,
            measurement: { date, weight_kg: weightKg, waist_cm: waistCm ?? null },
          });
          if (!result.ok) return failed(result.error);
        } else {
          const { error } = await ctx.supabase
            .from("body_logs")
            .upsert(
              { logged_on: date, weight_kg: weightKg, waist_cm: waistCm ?? null },
              { onConflict: "user_id,logged_on" },
            );
          if (error) return failed(error.message);
          revalidatePath("/health/body");
          revalidatePath("/health/report");
        }
        return changed(ctx, `Logged ${weightKg} kg for ${date}.`);
      },
    }),

    update_body_details: tool({
      description: "Change body details used for BMI and calories. Only pass what changed.",
      inputSchema: z.object({
        sex: z.enum(["male", "female"]).optional(),
        age: z.number().int().min(12).max(100).optional(),
        heightCm: z.number().min(100).max(250).optional(),
        activity: z.enum(ACTIVITIES.map((a) => a.value) as [BodyProfile["activity"], ...BodyProfile["activity"][]]).optional(),
        goal: z.enum(GOALS.map((g) => g.value) as [BodyProfile["goal"], ...BodyProfile["goal"][]]).optional(),
      }),
      execute: async ({ sex, age, heightCm, activity, goal }) => {
        const current = (await getBodyProfile()) ?? DEFAULT_BODY;
        const next: BodyProfile = {
          ...current,
          ...(sex ? { sex } : {}),
          ...(age ? { age } : {}),
          ...(heightCm ? { height_cm: heightCm } : {}),
          ...(activity ? { activity } : {}),
          ...(goal ? { goal } : {}),
        };
        const result = await saveBodyProfile({ profile: next });
        if (!result.ok) return failed(result.error);
        return changed(ctx, "Body details updated.", { details: next });
      },
    }),
  }),
};
