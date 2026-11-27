// Body metrics and training-block maths (safe for server and client).

export type Sex = "male" | "female";
export type Activity =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose" | "maintain" | "build" | "strength";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "full_gym" | "dumbbells" | "bodyweight";

export type BodyProfile = {
  sex: Sex;
  age: number | null;
  height_cm: number | null;
  activity: Activity;
  goal: Goal;
  experience: Experience;
  days_per_week: number;
  equipment: Equipment;
  session_minutes: number;
};

export type BodyLog = {
  id: string;
  logged_on: string; // YYYY-MM-DD
  weight_kg: number;
  waist_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
};

export const ACTIVITIES: {
  value: Activity;
  label: string;
  hint: string;
  factor: number;
}[] = [
  { value: "sedentary", label: "Desk job", hint: "Little or no exercise", factor: 1.2 },
  { value: "light", label: "Lightly active", hint: "1–3 workouts a week", factor: 1.375 },
  { value: "moderate", label: "Moderate", hint: "3–5 workouts a week", factor: 1.55 },
  { value: "active", label: "Very active", hint: "6–7 workouts a week", factor: 1.725 },
  { value: "very_active", label: "Athlete / labour", hint: "Twice a day or physical job", factor: 1.9 },
];

export const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: "lose", label: "Lose fat", hint: "Slight calorie deficit, more reps and cardio" },
  { value: "maintain", label: "Stay fit", hint: "Maintain weight, balanced training" },
  { value: "build", label: "Build muscle", hint: "Slight surplus, 8–12 rep range" },
  { value: "strength", label: "Get stronger", hint: "Heavy compounds, 4–6 reps" },
];

export const EXPERIENCES: { value: Experience; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Under 6 months of training" },
  { value: "intermediate", label: "Intermediate", hint: "6 months to 2 years" },
  { value: "advanced", label: "Advanced", hint: "2+ years of steady training" },
];

export const EQUIPMENTS: { value: Equipment; label: string; hint: string }[] = [
  { value: "full_gym", label: "Full gym", hint: "Machines, barbells, dumbbells" },
  { value: "dumbbells", label: "Dumbbells", hint: "Home setup with dumbbells" },
  { value: "bodyweight", label: "Bodyweight", hint: "No equipment" },
];

// Whether a change in weight is progress depends on the goal: down when losing
// fat, up when building muscle. For the other goals it is neither (null).
export function weightChangeIsGood(goal: Goal | null | undefined, change: number) {
  if (change === 0 || (goal !== "lose" && goal !== "build")) return null;
  return goal === "lose" ? change < 0 : change > 0;
}

// ---------------------------------------------------------------------------
// Body metrics
// ---------------------------------------------------------------------------
export function bmi(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) return null;
  return weightKg / (heightCm / 100) ** 2;
}

// WHO bands, with the lower Asian cut-offs noted in the app
export function bmiBand(value: number) {
  if (value < 18.5) return { label: "Underweight", tone: "warn" as const };
  if (value < 23) return { label: "Healthy", tone: "good" as const };
  if (value < 25) return { label: "Healthy (high for Asian range)", tone: "good" as const };
  if (value < 30) return { label: "Overweight", tone: "warn" as const };
  return { label: "Obese", tone: "bad" as const };
}

export function idealWeightRange(heightCm: number) {
  const m = heightCm / 100;
  return { min: 18.5 * m * m, max: 24.9 * m * m };
}

// Mifflin-St Jeor: the most accurate simple formula
export function bmr(profile: {
  sex: Sex;
  age: number | null;
  height_cm: number | null;
  weight_kg: number;
}) {
  const { sex, age, height_cm, weight_kg } = profile;
  if (!age || !height_cm) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export const activityFactor = (activity: Activity) =>
  ACTIVITIES.find((a) => a.value === activity)?.factor ?? 1.55;

export function tdee(restingRate: number, activity: Activity) {
  return restingRate * activityFactor(activity);
}

// Calories and grams for the goal: protein first, fat 25%, the rest carbs
export function nutritionTargets(
  maintenance: number,
  goal: Goal,
  weightKg: number,
) {
  const calories = Math.round(
    goal === "lose"
      ? maintenance * 0.8
      : goal === "build"
        ? maintenance * 1.1
        : goal === "strength"
          ? maintenance * 1.05
          : maintenance,
  );
  const protein = Math.round(weightKg * (goal === "lose" ? 2 : 1.8));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(
    Math.round((calories - protein * 4 - fat * 9) / 4),
    0,
  );
  return { calories, protein, fat, carbs };
}

// US Navy method (cm). Needs waist and neck, plus hip for women.
export function navyBodyFat(input: {
  sex: Sex;
  height_cm: number | null;
  waist_cm: number | null;
  neck_cm: number | null;
  hip_cm: number | null;
}) {
  const { sex, height_cm, waist_cm, neck_cm, hip_cm } = input;
  if (!height_cm || !waist_cm || !neck_cm) return null;
  if (sex === "male") {
    if (waist_cm <= neck_cm) return null;
    const value =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waist_cm - neck_cm) +
          0.15456 * Math.log10(height_cm)) -
      450;
    return clampFat(value);
  }
  if (!hip_cm || waist_cm + hip_cm <= neck_cm) return null;
  const value =
    495 /
      (1.29579 -
        0.35004 * Math.log10(waist_cm + hip_cm - neck_cm) +
        0.221 * Math.log10(height_cm)) -
    450;
  return clampFat(value);
}

const clampFat = (value: number) =>
  Number.isFinite(value) && value > 2 && value < 70 ? value : null;

export function bodyFatBand(percent: number, sex: Sex) {
  const cuts = sex === "male" ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (percent < cuts[0]) return "Very lean";
  if (percent < cuts[1]) return "Athletic";
  if (percent < cuts[2]) return "Fit";
  if (percent < cuts[3]) return "Average";
  return "High";
}

// ---------------------------------------------------------------------------
// Training block: weeks 1-3 build, the last week is a lighter deload
// ---------------------------------------------------------------------------
export type BlockWeek = {
  number: number; // 1-based
  deload: boolean;
  label: string;
  advice: string;
};

export function blockWeek(
  startDate: string,
  date: string,
  weeks: number,
): BlockWeek | null {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const day = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(day) || day < start)
    return null;
  const index = Math.floor((day - start) / 604_800_000); // 7 days
  if (index >= weeks) return null;
  const number = index + 1;
  const deload = number === weeks && weeks > 1;
  return {
    number,
    deload,
    label: `Week ${number} of ${weeks}`,
    advice: deload
      ? "Deload: lighter weights, stop well short of failure. Let your body catch up."
      : number === 1
        ? "Find your working weights. Leave about 2 reps in the tank."
        : number === 2
          ? "Add a rep or a little weight where week 1 felt easy."
          : "Hardest week: push close to failure on the last set.",
  };
}

// The target for an exercise in a given week of the block
export function weekTarget(
  exercise: { sets: number | null; reps: number | null; minutes: number | null },
  week: BlockWeek | null,
) {
  const sets = exercise.sets;
  const reps = exercise.reps;
  if (!week || !sets) return { sets, reps, minutes: exercise.minutes };
  if (week.deload)
    return {
      sets: Math.max(sets - 1, 1),
      reps,
      minutes: exercise.minutes,
      hint: "lighter",
    };
  // Weeks 2 and 3 add reps before weight
  const extra = week.number === 1 ? 0 : week.number === 2 ? 1 : 2;
  return {
    sets,
    reps: reps ? reps + extra : reps,
    minutes: exercise.minutes,
    hint: extra ? `+${extra} rep${extra > 1 ? "s" : ""} on week 1` : undefined,
  };
}

export function blockEnd(startDate: string, weeks: number) {
  const end = new Date(`${startDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + weeks * 7 - 1);
  return end.toISOString().slice(0, 10);
}
