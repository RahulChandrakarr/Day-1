import type { ExerciseCategory } from "@/lib/exercise-library";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const PATHS: Record<ExerciseCategory, React.ReactNode> = {
  // Dumbbell pressed across the chest
  chest: (
    <>
      <path d="M4 9v6M7 8v8M17 8v8M20 9v6" />
      <path d="M7 12h10" />
    </>
  ),
  // Pulling up to a bar
  back: (
    <>
      <path d="M3 4h18" />
      <path d="M6.5 4 9 10.5M17.5 4 15 10.5" />
      <circle cx="12" cy="8.5" r="2" />
      <path d="M9 10.5h6M12 10.5V16" />
      <path d="M12 16l-3 5M12 16l3 5" />
    </>
  ),
  // Overhead press
  shoulders: (
    <>
      <path d="M5 4h4M15 4h4M7 4v4M17 4v4" />
      <path d="M7 8h10" />
      <path d="M12 8v6M8 20l4-6 4 6" />
    </>
  ),
  // Curling a dumbbell
  arms: (
    <>
      <circle cx="9" cy="4" r="2" />
      <path d="M9 6v8M9 14l-2 7M9 14l2 7" />
      <path d="M9 8l1.5 5L15 9" />
      <path d="M13.5 7l3 3.5" />
    </>
  ),
  // Legs in a squat
  legs: (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v4l-3 4v6M12 10l3 4v6" />
      <path d="M6 20h3M15 20h3" />
    </>
  ),
  // Hip hinge with the bar hanging
  glutes: (
    <>
      <circle cx="5" cy="7.5" r="2" />
      <path d="M7 9.5l8 1.5" />
      <path d="M15 11l-1 5 1 5" />
      <path d="M9 10v6M6.5 16h5" />
    </>
  ),
  // Torso with a brace line
  core: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 6.5v7" />
      <path d="M8 8.5h8M8 11.5h8" />
      <path d="M12 13.5l-3 6M12 13.5l3 6" />
    </>
  ),
  // Running figure
  cardio: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M14 7l-2 4 3 3 1 6" />
      <path d="M12 11l-4 1-2 4" />
      <path d="M15 10l4 1" />
    </>
  ),
  // Circular motion arrows
  warmup: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  // Reaching, held stretch
  stretch: (
    <>
      <circle cx="9" cy="5" r="2" />
      <path d="M9 7v6l-2 7" />
      <path d="M9 13h4l3 6" />
      <path d="M9 9l6-3" />
    </>
  ),
  general: (
    <>
      <path d="M6 9v6M18 9v6" />
      <path d="M3 10.5v3M21 10.5v3" />
      <path d="M6 12h12" />
    </>
  ),
};

export function CategoryIcon({
  category,
  size = 18,
}: {
  category: ExerciseCategory;
  size?: number;
}) {
  return (
    <svg {...base} width={size} height={size}>
      {PATHS[category]}
    </svg>
  );
}

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  glutes: "Glutes",
  core: "Core",
  cardio: "Cardio",
  warmup: "Warm-up",
  stretch: "Stretch",
  general: "Training",
};
