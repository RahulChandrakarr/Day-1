"use client";

import { useReducedMotion } from "framer-motion";
import { CATEGORY_LABEL, CategoryIcon } from "@/components/health/exercise-icons";
import { sceneFor } from "@/components/health/motion";
import Figure from "@/components/health/motion/figure";
import type { ExerciseCategory } from "@/lib/exercise-library";

// A looping stick figure doing the exercise, with the working muscles
// highlighted. Exercises we can't recognise show their icon instead.
export default function MotionIllustration({
  name,
  category,
  tone,
  className = "",
}: {
  name: string;
  category: ExerciseCategory;
  tone: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const scene = sceneFor(name);

  if (!scene) {
    return (
      <div className={`flex items-center justify-center opacity-60 ${className}`} role="img" aria-label={CATEGORY_LABEL[category]}>
        <CategoryIcon category={category} size={56} />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`How to do ${name}`}
      className={className}
    >
      <Figure scene={scene} still={Boolean(reduced)} tone={tone} />
    </svg>
  );
}
