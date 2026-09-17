// Builds a training block from the body profile: which days, which exercises,
// how many sets and reps. Same input (including the seed) gives the same plan.

import type { BodyProfile, Equipment, Experience, Goal } from "@/lib/fitness";
import type { Phase } from "@/lib/health";

type Slot =
  | "squat"
  | "hinge"
  | "quad"
  | "ham"
  | "calves"
  | "push_h"
  | "push_incline"
  | "push_v"
  | "pull_v"
  | "pull_h"
  | "side_delt"
  | "rear_delt"
  | "biceps"
  | "triceps"
  | "core"
  | "cardio";

type LibraryItem = {
  name: string;
  slot: Slot;
  muscle: string;
  equipment: Equipment[]; // where it can be done
  level: Experience[]; // who it suits
  compound?: boolean;
  minutes?: number; // cardio / timed work
  note?: string;
};

// Ordered by preference inside each slot; later entries are the variations
// used in later blocks, so the plan changes month to month.
const LIBRARY: LibraryItem[] = [
  // Legs
  { name: "Leg press", slot: "squat", muscle: "Quads", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Feet shoulder width, don't lock the knees" },
  { name: "Barbell back squat", slot: "squat", muscle: "Quads", equipment: ["full_gym"], level: ["intermediate", "advanced"], compound: true, note: "Brace your core, sit between your hips" },
  { name: "Goblet squat", slot: "squat", muscle: "Quads", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Heels down, chest tall" },
  { name: "Bodyweight squat", slot: "squat", muscle: "Quads", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"], compound: true },
  { name: "Bulgarian split squat", slot: "squat", muscle: "Quads", equipment: ["full_gym", "dumbbells", "bodyweight"], level: ["intermediate", "advanced"], compound: true, note: "Per leg" },

  { name: "Romanian deadlift", slot: "hinge", muscle: "Hamstrings", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Soft knees, hinge at the hips, flat back" },
  { name: "Deadlift", slot: "hinge", muscle: "Back & hamstrings", equipment: ["full_gym"], level: ["intermediate", "advanced"], compound: true, note: "Bar close to the shins" },
  { name: "Hip thrust", slot: "hinge", muscle: "Glutes", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Squeeze at the top" },
  { name: "Glute bridge", slot: "hinge", muscle: "Glutes", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"] },

  { name: "Leg extension", slot: "quad", muscle: "Quads", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Walking lunge", slot: "quad", muscle: "Quads & glutes", equipment: ["full_gym", "dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], note: "Steps per leg" },
  { name: "Step-up", slot: "quad", muscle: "Quads", equipment: ["dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], note: "Per leg" },

  { name: "Lying leg curl", slot: "ham", muscle: "Hamstrings", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Seated leg curl", slot: "ham", muscle: "Hamstrings", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Nordic curl (assisted)", slot: "ham", muscle: "Hamstrings", equipment: ["bodyweight", "dumbbells"], level: ["intermediate", "advanced"] },

  { name: "Standing calf raise", slot: "calves", muscle: "Calves", equipment: ["full_gym", "dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], note: "Pause at the top" },
  { name: "Seated calf raise", slot: "calves", muscle: "Calves", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"] },

  // Push
  { name: "Barbell bench press", slot: "push_h", muscle: "Chest", equipment: ["full_gym"], level: ["intermediate", "advanced"], compound: true, note: "Shoulder blades pulled back" },
  { name: "Chest press machine", slot: "push_h", muscle: "Chest", equipment: ["full_gym"], level: ["beginner", "intermediate"], compound: true, note: "Handles at mid-chest height" },
  { name: "Dumbbell bench press", slot: "push_h", muscle: "Chest", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true },
  { name: "Push-ups", slot: "push_h", muscle: "Chest", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Knees down if needed" },

  { name: "Incline dumbbell press", slot: "push_incline", muscle: "Upper chest", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Bench at 30–45°" },
  { name: "Cable fly", slot: "push_incline", muscle: "Chest", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], note: "Light weight, wide arc" },
  { name: "Decline push-ups", slot: "push_incline", muscle: "Upper chest", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"] },

  { name: "Dumbbell shoulder press", slot: "push_v", muscle: "Shoulders", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Seated, back supported" },
  { name: "Overhead barbell press", slot: "push_v", muscle: "Shoulders", equipment: ["full_gym"], level: ["intermediate", "advanced"], compound: true },
  { name: "Pike push-ups", slot: "push_v", muscle: "Shoulders", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"], compound: true },

  { name: "Lateral raise", slot: "side_delt", muscle: "Side delts", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], note: "Light weight, lead with the elbows" },
  { name: "Cable lateral raise", slot: "side_delt", muscle: "Side delts", equipment: ["full_gym"], level: ["intermediate", "advanced"] },

  { name: "Triceps rope pushdown", slot: "triceps", muscle: "Triceps", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], note: "Elbows pinned to your sides" },
  { name: "Overhead dumbbell extension", slot: "triceps", muscle: "Triceps", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Skull crusher", slot: "triceps", muscle: "Triceps", equipment: ["full_gym", "dumbbells"], level: ["intermediate", "advanced"] },
  { name: "Diamond push-ups", slot: "triceps", muscle: "Triceps", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"] },

  // Pull
  { name: "Lat pulldown", slot: "pull_v", muscle: "Lats", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Pull to the collarbone" },
  { name: "Pull-ups (assisted if needed)", slot: "pull_v", muscle: "Lats", equipment: ["full_gym", "bodyweight"], level: ["intermediate", "advanced"], compound: true },
  { name: "Single-arm dumbbell pullover", slot: "pull_v", muscle: "Lats", equipment: ["dumbbells"], level: ["beginner", "intermediate", "advanced"] },

  { name: "Seated cable row", slot: "pull_h", muscle: "Mid back", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Chest up, squeeze the shoulder blades" },
  { name: "One-arm dumbbell row", slot: "pull_h", muscle: "Mid back", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Per side" },
  { name: "Barbell row", slot: "pull_h", muscle: "Mid back", equipment: ["full_gym"], level: ["intermediate", "advanced"], compound: true },
  { name: "Inverted row", slot: "pull_h", muscle: "Mid back", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"], compound: true, note: "Under a table or bar" },

  { name: "Face pull", slot: "rear_delt", muscle: "Rear delts", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], note: "Great for posture" },
  { name: "Rear delt fly", slot: "rear_delt", muscle: "Rear delts", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Reverse snow angel", slot: "rear_delt", muscle: "Rear delts", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"] },

  { name: "Barbell curl", slot: "biceps", muscle: "Biceps", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], note: "No swinging" },
  { name: "Dumbbell hammer curl", slot: "biceps", muscle: "Biceps", equipment: ["full_gym", "dumbbells"], level: ["beginner", "intermediate", "advanced"] },
  { name: "Incline dumbbell curl", slot: "biceps", muscle: "Biceps", equipment: ["full_gym", "dumbbells"], level: ["intermediate", "advanced"], note: "Stretch at the bottom" },
  { name: "Towel curl", slot: "biceps", muscle: "Biceps", equipment: ["bodyweight"], level: ["beginner", "intermediate", "advanced"] },

  // Core and cardio
  { name: "Plank", slot: "core", muscle: "Core", equipment: ["full_gym", "dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], minutes: 1, note: "1 minute per set" },
  { name: "Hanging knee raise", slot: "core", muscle: "Core", equipment: ["full_gym"], level: ["intermediate", "advanced"] },
  { name: "Dead bug", slot: "core", muscle: "Core", equipment: ["full_gym", "dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], note: "Slow and controlled" },
  { name: "Cable woodchopper", slot: "core", muscle: "Core", equipment: ["full_gym"], level: ["intermediate", "advanced"] },

  { name: "Treadmill walk (incline)", slot: "cardio", muscle: "Cardio", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], minutes: 15, note: "Brisk pace you can still talk at" },
  { name: "Cycle", slot: "cardio", muscle: "Cardio", equipment: ["full_gym"], level: ["beginner", "intermediate", "advanced"], minutes: 15 },
  { name: "Skipping / jogging", slot: "cardio", muscle: "Cardio", equipment: ["dumbbells", "bodyweight"], level: ["beginner", "intermediate", "advanced"], minutes: 15 },
];

// What a day trains, so the warm-up and cool-down match it
type Focus = "push" | "pull" | "upper" | "lower" | "full";

const ALL_FOCUS: Focus[] = ["push", "pull", "upper", "lower", "full"];
const UPPER_FOCUS: Focus[] = ["push", "pull", "upper"];

type PrepItem = {
  name: string;
  muscle: string;
  focus: Focus[];
  pulse?: boolean; // raises the heart rate, goes first
  equipment?: Equipment[]; // anywhere when left out
  sets?: number;
  reps?: number;
  minutes?: number;
  note?: string;
};

const WARMUP: PrepItem[] = [
  { name: "Jumping jacks", muscle: "Full body", focus: ALL_FOCUS, pulse: true, minutes: 2 },
  { name: "High knees", muscle: "Hips & calves", focus: ALL_FOCUS, pulse: true, minutes: 1 },
  { name: "Arm circles", muscle: "Shoulders", focus: [...UPPER_FOCUS, "full"], sets: 1, reps: 20, note: "10 forward, 10 back" },
  { name: "Band pull-apart", muscle: "Upper back", focus: UPPER_FOCUS, equipment: ["full_gym"], sets: 2, reps: 15, note: "Light band" },
  { name: "Shoulder dislocates", muscle: "Shoulders", focus: UPPER_FOCUS, sets: 1, reps: 12, note: "Band or broomstick, wide grip" },
  { name: "Cat-cow", muscle: "Spine", focus: ALL_FOCUS, sets: 1, reps: 10 },
  { name: "Inchworm walkout", muscle: "Hamstrings & shoulders", focus: ALL_FOCUS, sets: 1, reps: 6 },
  { name: "Leg swings", muscle: "Hips & hamstrings", focus: ["lower", "full"], sets: 1, reps: 12, note: "Per leg, front-back then side to side" },
  { name: "Hip circles", muscle: "Hips", focus: ["lower", "full"], sets: 1, reps: 10, note: "Per leg, each direction" },
  { name: "Air squat", muscle: "Hips & knees", focus: ["lower", "full"], sets: 1, reps: 15, note: "Slow, a little deeper each rep" },
];

const COOLDOWN: PrepItem[] = [
  { name: "Doorway chest stretch", muscle: "Chest", focus: ["push", "upper", "full"], minutes: 1, note: "30 s per side" },
  { name: "Cross-body shoulder stretch", muscle: "Shoulders", focus: UPPER_FOCUS, minutes: 1, note: "30 s per side" },
  { name: "Triceps overhead stretch", muscle: "Triceps", focus: ["push", "upper"], minutes: 1, note: "30 s per side" },
  { name: "Wall biceps stretch", muscle: "Biceps", focus: ["pull", "upper"], minutes: 1, note: "30 s per side" },
  { name: "Lat stretch", muscle: "Lats", focus: ["pull", "upper", "full"], minutes: 1 },
  { name: "Child's pose", muscle: "Lower back", focus: ALL_FOCUS, minutes: 1 },
  { name: "Cobra stretch", muscle: "Abs & hip flexors", focus: ["push", "lower", "full"], minutes: 1 },
  { name: "Standing quad stretch", muscle: "Quads", focus: ["lower", "full"], minutes: 1, note: "30 s per side" },
  { name: "Seated hamstring stretch", muscle: "Hamstrings", focus: ["lower", "full"], minutes: 1, note: "30 s per side" },
  { name: "Figure-four glute stretch", muscle: "Glutes", focus: ["lower", "full"], minutes: 1, note: "30 s per side" },
  { name: "Calf stretch on wall", muscle: "Calves", focus: ["lower"], minutes: 1, note: "30 s per side" },
];

type DayTemplate = { title: string; focus: Focus; slots: Slot[] };

// Day patterns, most important movements first
const TEMPLATES: Record<string, DayTemplate> = {
  full_body: { title: "Full body", focus: "full", slots: ["squat", "push_h", "pull_h", "hinge", "push_v", "pull_v", "core", "cardio"] },
  upper: { title: "Upper body", focus: "upper", slots: ["push_h", "pull_v", "push_v", "pull_h", "side_delt", "biceps", "triceps", "core"] },
  lower: { title: "Lower body", focus: "lower", slots: ["squat", "hinge", "quad", "ham", "calves", "core", "cardio"] },
  push: { title: "Push · chest, shoulders, triceps", focus: "push", slots: ["push_h", "push_incline", "push_v", "side_delt", "triceps", "triceps", "core"] },
  pull: { title: "Pull · back and biceps", focus: "pull", slots: ["pull_v", "pull_h", "rear_delt", "biceps", "biceps", "core", "cardio"] },
  legs: { title: "Legs", focus: "lower", slots: ["squat", "hinge", "quad", "ham", "calves", "core"] },
};

// FNV-1a, turns the seed text into a number
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: a tiny repeatable random source
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Which template runs on which day, by how many days a week you train
function weekPlan(days: number, level: Experience): { weekday: number; template: string }[] {
  const pick = (weekdays: number[], templates: string[]) =>
    weekdays.map((weekday, i) => ({ weekday, template: templates[i] }));

  if (days <= 2) return pick([1, 4], ["full_body", "full_body"]);
  if (days === 3)
    return level === "beginner"
      ? pick([1, 3, 5], ["full_body", "full_body", "full_body"])
      : pick([1, 3, 5], ["push", "pull", "legs"]);
  if (days === 4) return pick([1, 2, 4, 5], ["upper", "lower", "upper", "lower"]);
  if (days === 5)
    return pick([1, 2, 3, 5, 6], ["push", "pull", "legs", "upper", "lower"]);
  return pick([1, 2, 3, 4, 5, 6], ["push", "pull", "legs", "push", "pull", "legs"]);
}

export const SPLIT_OF: Record<number, "full_body" | "upper_lower" | "ppl"> = {
  2: "full_body",
  3: "full_body",
  4: "upper_lower",
  5: "upper_lower",
  6: "ppl",
};

type GeneratedExercise = {
  name: string;
  muscle: string;
  sets: number | null;
  reps: number | null;
  minutes: number | null;
  rest_seconds: number | null;
  rir: number | null;
  note: string | null;
  phase: Phase;
};

export type GeneratedDay = {
  weekday: number;
  title: string;
  rest: boolean;
  exercises: GeneratedExercise[];
};

// Sets, reps and rest for the goal
function prescription(goal: Goal, compound: boolean, level: Experience) {
  const beginner = level === "beginner";
  if (goal === "strength")
    return compound
      ? { sets: beginner ? 3 : 4, reps: 5, rest: 180 }
      : { sets: 3, reps: 8, rest: 90 };
  if (goal === "lose")
    return compound
      ? { sets: 3, reps: 12, rest: 60 }
      : { sets: 3, reps: 15, rest: 45 };
  if (goal === "maintain")
    return compound
      ? { sets: 3, reps: 10, rest: 90 }
      : { sets: 3, reps: 12, rest: 60 };
  // build
  return compound
    ? { sets: beginner ? 3 : 4, reps: beginner ? 10 : 8, rest: 120 }
    : { sets: 3, reps: 12, rest: 75 };
}

function mainExercise(item: LibraryItem, goal: Goal, level: Experience): GeneratedExercise {
  const base = { name: item.name, muscle: item.muscle, note: item.note ?? null, phase: "main" as const };
  if (item.slot === "cardio")
    return { ...base, sets: null, reps: null, minutes: goal === "lose" ? 20 : 15, rest_seconds: null, rir: null };
  if (item.minutes)
    return { ...base, sets: 3, reps: null, minutes: item.minutes, rest_seconds: 60, rir: null };
  const p = prescription(goal, Boolean(item.compound), level);
  return {
    ...base,
    sets: p.sets,
    reps: p.reps,
    minutes: null,
    rest_seconds: p.rest,
    rir: goal === "strength" ? 3 : 2,
  };
}

function prepFor(
  list: PrepItem[],
  focus: Focus,
  equipment: Equipment,
  count: number,
  phase: Phase,
  rand: () => number,
): GeneratedExercise[] {
  const options = list.filter(
    (p) => p.focus.includes(focus) && (!p.equipment || p.equipment.includes(equipment)),
  );
  return shuffled(options, rand)
    .slice(0, count)
    .map((p) => ({
      name: p.name,
      muscle: p.muscle,
      sets: p.sets ?? null,
      reps: p.reps ?? null,
      minutes: p.minutes ?? null,
      rest_seconds: null,
      rir: null,
      note: p.note ?? null,
      phase,
    }));
}

// 1 move to raise the heart rate, 2 for mobility, then 3 stretches after
function prep(focus: Focus, equipment: Equipment, rand: () => number) {
  return {
    warmup: [
      ...prepFor(WARMUP.filter((p) => p.pulse), focus, equipment, 1, "warmup", rand),
      ...prepFor(WARMUP.filter((p) => !p.pulse), focus, equipment, 2, "warmup", rand),
    ],
    cooldown: prepFor(COOLDOWN, focus, equipment, 3, "cooldown", rand),
  };
}

// Works for generated titles ("Push · chest…", "Legs (B)") and hand-typed ones
function focusFromTitle(title: string): Focus {
  const t = title.toLowerCase();
  if (t.includes("full")) return "full";
  if (t.includes("upper")) return "upper";
  if (/lower|leg|glute|squat|quad|hamstring/.test(t)) return "lower";
  if (/push|chest|tricep|shoulder/.test(t)) return "push";
  if (/pull|back|bicep|lat/.test(t)) return "pull";
  if (t.includes("arm")) return "upper";
  return "full";
}

// Warm-up and cool-down for a day that was planned without them
export function prepForDay(title: string, equipment: Equipment, seed: string) {
  return prep(focusFromTitle(title), equipment, random(hash(`${seed}:${title}`)));
}

const isFinisher = (item: LibraryItem) => item.slot === "core" || item.slot === "cardio";

// Builds one month of training. blockNumber rotates the exercise choices;
// seed (the user's id) gives each person their own variations and order, so
// people on the same split aren't all waiting for the same machine.
export function generateBlock(
  profile: BodyProfile,
  blockNumber: number,
  seed = "",
): { name: string; split: string; days: GeneratedDay[] } {
  const { equipment, experience, goal, days_per_week, session_minutes } = profile;
  // About 10 minutes of each session goes to the warm-up and cool-down
  const perDay = Math.min(Math.max(Math.round((session_minutes - 10) / 9), 4), 9);
  const layout = weekPlan(days_per_week, experience);
  const trainingDays = new Set(layout.map((d) => d.weekday));

  const days: GeneratedDay[] = [];
  // When a template repeats in the week (e.g. push twice), the second one
  // uses the next exercise variation so the two sessions differ
  const seen = new Map<string, number>();
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (!trainingDays.has(weekday)) {
      days.push({ weekday, title: "Rest", rest: true, exercises: [] });
      continue;
    }
    const { template } = layout.find((d) => d.weekday === weekday)!;
    const { title, focus, slots } = TEMPLATES[template];
    const round = seen.get(template) ?? 0;
    seen.set(template, round + 1);
    const rand = random(hash(`${seed}:${blockNumber}:${weekday}`));
    const used = new Set<string>();
    const picked: LibraryItem[] = [];

    for (const slot of slots) {
      if (picked.length >= perDay) break;
      const options = LIBRARY.filter(
        (item) =>
          item.slot === slot &&
          item.equipment.includes(equipment) &&
          item.level.includes(experience) &&
          !used.has(item.name),
      );
      if (options.length === 0) continue;
      // Cardio only for fat loss and general fitness
      if (slot === "cardio" && goal !== "lose" && goal !== "maintain") continue;
      // Each slot gets its own offset per person, so two people on the same
      // template land on different variations; it still moves on every block
      const offset = seed ? hash(`${seed}:${slot}`) : 0;
      const item = options[(blockNumber - 1 + round + offset) % options.length];
      used.add(item.name);
      picked.push(item);
    }

    // Heavy compound lifts still come first while you're fresh and core or
    // cardio stays last; only the order inside each group is shuffled
    const main = [
      ...shuffled(picked.filter((item) => !isFinisher(item) && item.compound), rand),
      ...shuffled(picked.filter((item) => !isFinisher(item) && !item.compound), rand),
      ...picked.filter(isFinisher),
    ].map((item) => mainExercise(item, goal, experience));

    const { warmup, cooldown } = prep(focus, equipment, rand);
    days.push({
      weekday,
      title: round > 0 ? `${title} (B)` : title,
      rest: false,
      exercises: [...warmup, ...main, ...cooldown],
    });
  }

  const goalName =
    goal === "lose" ? "Fat loss" : goal === "strength" ? "Strength" : goal === "maintain" ? "Fitness" : "Muscle";
  return {
    name: `${goalName} · block ${blockNumber}`,
    split: SPLIT_OF[days_per_week] ?? "custom",
    days,
  };
}
