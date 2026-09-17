"use client";

import { useReducedMotion } from "framer-motion";
import { CATEGORY_LABEL } from "./exercise-icons";
import type { ExerciseCategory } from "@/lib/exercise-library";

// A looping line drawing of the movement pattern, so you can see roughly what
// the exercise looks like without leaving the app.

const SPLINE = { calcMode: "spline" as const, keyTimes: "0;0.5;1", keySplines: "0.4 0 0.2 1;0.4 0 0.2 1" };

function Morph({
  still,
  attr = "d",
  values,
  dur = "2.6s",
}: {
  still: boolean;
  attr?: string;
  values: string;
  dur?: string;
}) {
  if (still) return null;
  return (
    <animate
      attributeName={attr}
      values={values}
      dur={dur}
      repeatCount="indefinite"
      {...SPLINE}
    />
  );
}

function Shift({ still, values, dur = "2.6s" }: { still: boolean; values: string; dur?: string }) {
  if (still) return null;
  return (
    <animateTransform
      attributeName="transform"
      type="translate"
      values={values}
      dur={dur}
      repeatCount="indefinite"
      {...SPLINE}
    />
  );
}

function Turn({
  still,
  values,
  dur = "2.6s",
  linear = false,
}: {
  still: boolean;
  values: string;
  dur?: string;
  linear?: boolean;
}) {
  if (still) return null;
  return (
    <animateTransform
      attributeName="transform"
      type="rotate"
      values={values}
      dur={dur}
      repeatCount="indefinite"
      {...(linear ? {} : SPLINE)}
    />
  );
}

function Cycle({ still, values, dur }: { still: boolean; values: string[]; dur: string }) {
  if (still) return null;
  return <animate attributeName="d" values={values.join(";")} dur={dur} repeatCount="indefinite" />;
}

// Hands trace small ellipses beside the body, mirrored left and right
const ARM_CIRCLE = Array.from({ length: 9 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  const dx = +(3 * Math.cos(a)).toFixed(1);
  const dy = +(6 * Math.sin(a)).toFixed(1);
  return `M56 34L${42 + dx} ${31 + dy}M64 34L${78 - dx} ${31 + dy}`;
});

const Ground = () => <path d="M18 72H102" className="opacity-20" />;

const SCENES: Record<ExerciseCategory, (still: boolean) => React.ReactNode> = {
  legs: (still) => (
    <>
      <Ground />
      <circle cx="60" cy="20" r="6">
        <Morph still={still} attr="cy" values="20;31;20" />
      </circle>
      <path d="M60 26L60 46">
        <Morph still={still} values="M60 26L60 46;M60 37L60 53;M60 26L60 46" />
      </path>
      <path d="M60 32L75 36">
        <Morph still={still} values="M60 32L75 36;M60 43L79 35;M60 32L75 36" />
      </path>
      <path d="M60 46L53 59L53 71M60 46L67 59L67 71">
        <Morph
          still={still}
          values="M60 46L53 59L53 71M60 46L67 59L67 71;M60 53L45 59L52 71M60 53L75 59L68 71;M60 46L53 59L53 71M60 46L67 59L67 71"
        />
      </path>
    </>
  ),
  // Hip hinge: the torso tips forward, the bar hangs straight down
  glutes: (still) => (
    <>
      <Ground />
      <path d="M60 50L57 60L58 71M60 50L63 60L62 71" />
      <g>
        <Turn still={still} values="0 60 50;72 60 50;0 60 50" />
        <circle cx="60" cy="24" r="6" />
        <path d="M60 30L60 50" />
      </g>
      <path d="M60 34L66 47">
        <Morph still={still} values="M60 34L66 47;M75 45L75 60;M60 34L66 47" />
      </path>
      <circle cx="66" cy="49" r="3">
        <Morph still={still} attr="cx" values="66;75;66" />
        <Morph still={still} attr="cy" values="49;62;49" />
      </circle>
    </>
  ),
  chest: (still) => (
    <>
      <path d="M28 57H92" className="opacity-20" />
      <circle cx="34" cy="49" r="5" />
      <path d="M40 53H74L84 61L84 69" />
      <path d="M64 53L64 31M70 53L70 31">
        <Morph still={still} values="M64 53L64 31M70 53L70 31;M64 53L64 43M70 53L70 43;M64 53L64 31M70 53L70 31" />
      </path>
      <g>
        <Shift still={still} values="0 0;0 12;0 0" />
        <path d="M52 30H82" />
        <path d="M54 25V35M80 25V35" />
      </g>
    </>
  ),
  // Seated pulldown, seen from the front: the bar comes down to the collarbone
  back: (still) => (
    <>
      <path d="M36 70H84" className="opacity-20" />
      <circle cx="60" cy="30" r="6" />
      <path d="M60 36L60 56" />
      <path d="M60 56L48 58L48 70M60 56L72 58L72 70" />
      <path d="M60 40L50 26L46 13M60 40L70 26L74 13">
        <Morph
          still={still}
          values="M60 40L50 26L46 13M60 40L70 26L74 13;M60 40L46 50L43 42M60 40L74 50L77 42;M60 40L50 26L46 13M60 40L70 26L74 13"
        />
      </path>
      <g>
        <Shift still={still} values="0 0;0 29;0 0" />
        <path d="M37 17L41 13H79L83 17" />
      </g>
    </>
  ),
  // Overhead press: the bar goes up either side of the head
  shoulders: (still) => (
    <>
      <Ground />
      <circle cx="60" cy="37" r="6" />
      <path d="M53 46H67M60 43L60 62" />
      <path d="M60 62L52 72M60 62L68 72" />
      <path d="M53 46L45 38L46 28M67 46L75 38L74 28">
        <Morph
          still={still}
          values="M53 46L45 38L46 28M67 46L75 38L74 28;M53 46L48 32L47 17M67 46L72 32L73 17;M53 46L45 38L46 28M67 46L75 38L74 28"
        />
      </path>
      <g>
        <Shift still={still} values="0 0;0 -11;0 0" />
        <path d="M40 28H80" />
        <path d="M42 23V33M78 23V33" />
      </g>
    </>
  ),
  // Biceps curl from the side: the forearm swings up from the elbow
  arms: (still) => (
    <>
      <Ground />
      <circle cx="46" cy="20" r="5" />
      <path d="M46 25L46 50" />
      <path d="M46 50L41 71M46 50L51 71" />
      <path d="M47 30L52 45" />
      <g>
        <Turn still={still} values="60 52 45;-60 52 45;60 52 45" />
        <path d="M52 45L68 45" />
        <path d="M66 40V50M70 40V50" />
      </g>
    </>
  ),
  core: (still) => (
    <>
      <path d="M24 66H96" className="opacity-20" />
      <circle cx="34" cy="57" r="5" />
      <path d="M40 62H70" />
      <path d="M70 62L82 62L92 62">
        <Morph still={still} values="M70 62L82 62L92 62;M70 62L80 53L87 43;M70 62L82 62L92 62" />
      </path>
      <path d="M50 62L45 51">
        <Morph still={still} values="M50 62L45 51;M50 62L56 47;M50 62L45 51" />
      </path>
    </>
  ),
  cardio: (still) => (
    <>
      <Ground />
      <circle cx="66" cy="18" r="5" />
      <path d="M64 23L58 46" />
      <path d="M62 30L74 37M62 30L50 26">
        <Morph
          still={still}
          dur="1.1s"
          values="M62 30L74 37M62 30L50 26;M62 30L74 27M62 30L52 39;M62 30L74 37M62 30L50 26"
        />
      </path>
      <path d="M58 46L50 58L44 69M58 46L68 56L72 69">
        <Morph
          still={still}
          dur="1.1s"
          values="M58 46L50 58L44 69M58 46L68 56L72 69;M58 46L67 56L74 63M58 46L49 58L46 69;M58 46L50 58L44 69M58 46L68 56L72 69"
        />
      </path>
    </>
  ),
  // Arm circles: each straight arm makes small circles at the side
  warmup: (still) => (
    <>
      <Ground />
      <circle cx="60" cy="22" r="6" />
      <path d="M56 34H64M60 28L60 52" />
      <path d="M60 52L52 71M60 52L68 71" />
      <ellipse cx="42" cy="31" rx="4.5" ry="8" className="opacity-25" strokeDasharray="2 3" />
      <ellipse cx="78" cy="31" rx="4.5" ry="8" className="opacity-25" strokeDasharray="2 3" />
      <path d={ARM_CIRCLE[0]}>
        <Cycle still={still} values={ARM_CIRCLE} dur="1.6s" />
      </path>
    </>
  ),
  // Side stretch: one arm goes up and over as the body leans
  stretch: (still) => (
    <>
      <Ground />
      <path d="M60 50L52 71M60 50L68 71" />
      <g>
        <Turn still={still} values="0 60 50;-16 60 50;0 60 50" dur="3.2s" />
        <circle cx="60" cy="24" r="6" />
        <path d="M56 33H64M60 30L60 50" />
        <path d="M56 33L52 43L57 49" />
        <path d="M64 33L67 23L69 13">
          <Morph still={still} dur="3.2s" values="M64 33L67 23L69 13;M64 33L68 20L56 12;M64 33L67 23L69 13" />
        </path>
      </g>
    </>
  ),
  // Lateral raise with dumbbells
  general: (still) => (
    <>
      <Ground />
      <circle cx="60" cy="22" r="6" />
      <path d="M56 34H64M60 28L60 52" />
      <path d="M60 52L52 71M60 52L68 71" />
      <path d="M56 34L45 47M64 34L75 47">
        <Morph still={still} values="M56 34L45 47M64 34L75 47;M56 34L41 30M64 34L79 30;M56 34L45 47M64 34L75 47" />
      </path>
      <g>
        <Shift still={still} values="0 0;-4 -17;0 0" />
        <path d="M42 45L48 49" />
      </g>
      <g>
        <Shift still={still} values="0 0;4 -17;0 0" />
        <path d="M78 45L72 49" />
      </g>
    </>
  ),
};

export default function MotionIllustration({
  category,
  className = "",
}: {
  category: ExerciseCategory;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <svg
      viewBox="10 6 100 70"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`${CATEGORY_LABEL[category]} movement`}
      className={className}
    >
      {SCENES[category](Boolean(reduced))}
    </svg>
  );
}
