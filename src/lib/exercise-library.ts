// What each exercise trains and how to do it, so the tracker can explain a
// movement without sending you to Google. Keyed by lowercased name.

import type { Phase } from "./health";

export type ExerciseCategory =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "glutes"
  | "core"
  | "cardio"
  | "warmup"
  | "stretch"
  | "general";

export type ExerciseInfo = {
  category: ExerciseCategory;
  target: string;
  instructions: string[];
};

const L: Record<string, ExerciseInfo> = {
  // Legs
  "leg press": {
    category: "legs",
    target: "Quads, glutes and hamstrings",
    instructions: [
      "Sit back with your feet shoulder width on the platform, heels flat.",
      "Lower until your knees reach about 90°, keeping your lower back on the pad.",
      "Press through mid-foot without snapping the knees straight at the top.",
    ],
  },
  "barbell back squat": {
    category: "legs",
    target: "Quads and glutes, with the core and upper back bracing",
    instructions: [
      "Bar on your upper back, feet shoulder width, toes slightly out.",
      "Brace your core, then sit down and back between your hips.",
      "Go as deep as you can with a flat back, then drive up through mid-foot.",
    ],
  },
  "goblet squat": {
    category: "legs",
    target: "Quads and glutes",
    instructions: [
      "Hold a dumbbell or kettlebell against your chest, elbows tucked in.",
      "Squat down with your chest tall and heels planted.",
      "Stand back up, squeezing the glutes at the top.",
    ],
  },
  "bodyweight squat": {
    category: "legs",
    target: "Quads and glutes",
    instructions: [
      "Feet shoulder width, arms out in front for balance.",
      "Sit down and back until your thighs are about parallel to the floor.",
      "Push through the whole foot to stand.",
    ],
  },
  "bulgarian split squat": {
    category: "legs",
    target: "Quads and glutes, one leg at a time",
    instructions: [
      "Put the top of your back foot on a bench, front foot a stride ahead.",
      "Lower straight down until the back knee is near the floor.",
      "Drive up through the front heel. Finish all reps, then swap legs.",
    ],
  },
  "romanian deadlift": {
    category: "glutes",
    target: "Hamstrings and glutes, plus the lower back",
    instructions: [
      "Stand with soft knees, bar or dumbbells against your thighs.",
      "Push your hips back and slide the weight down your legs, back flat.",
      "Stop when you feel a hamstring stretch, then drive the hips forward.",
    ],
  },
  deadlift: {
    category: "back",
    target: "Hamstrings, glutes, and the whole back",
    instructions: [
      "Bar over mid-foot, shins close, grip just outside the knees.",
      "Chest up, back flat, then push the floor away and stand tall.",
      "Lower under control by pushing your hips back first.",
    ],
  },
  "hip thrust": {
    category: "glutes",
    target: "Glutes, with hamstring support",
    instructions: [
      "Upper back on a bench, weight across your hips, feet flat.",
      "Drive through your heels until your body is flat from knee to shoulder.",
      "Squeeze hard at the top for a second, then lower slowly.",
    ],
  },
  "glute bridge": {
    category: "glutes",
    target: "Glutes and hamstrings",
    instructions: [
      "Lie on your back, knees bent, feet flat and close to your hips.",
      "Push through the heels and lift the hips until your body is straight.",
      "Pause at the top, then lower without resting fully between reps.",
    ],
  },
  "leg extension": {
    category: "legs",
    target: "Quads",
    instructions: [
      "Sit with the pad on your shins, knees lined up with the pivot.",
      "Straighten your legs and pause briefly at the top.",
      "Lower slowly; don't let the stack slam down.",
    ],
  },
  "walking lunge": {
    category: "legs",
    target: "Quads and glutes",
    instructions: [
      "Step forward into a lunge, back knee lowering toward the floor.",
      "Push off the front heel and step straight into the next lunge.",
      "Keep your torso tall throughout. Steps are counted per leg.",
    ],
  },
  "step-up": {
    category: "legs",
    target: "Quads and glutes, one leg at a time",
    instructions: [
      "Place one foot fully on a box about knee height.",
      "Drive through that heel to stand up; avoid pushing off the back foot.",
      "Lower under control. Finish all reps, then swap legs.",
    ],
  },
  "lying leg curl": {
    category: "legs",
    target: "Hamstrings",
    instructions: [
      "Lie face down with the pad just above your heels.",
      "Curl your heels toward your glutes and squeeze.",
      "Lower slowly, keeping your hips on the bench.",
    ],
  },
  "seated leg curl": {
    category: "legs",
    target: "Hamstrings",
    instructions: [
      "Sit with the pad on your lower shins and the lap pad locked down.",
      "Curl your heels under and back, pausing at the deepest point.",
      "Return slowly without letting the weight yank your knees straight.",
    ],
  },
  "nordic curl (assisted)": {
    category: "legs",
    target: "Hamstrings, eccentric strength",
    instructions: [
      "Kneel with your ankles anchored, body straight from knee to head.",
      "Lower forward as slowly as you can, resisting the whole way.",
      "Catch yourself with your hands and push back to the start.",
    ],
  },
  "standing calf raise": {
    category: "legs",
    target: "Calves",
    instructions: [
      "Stand with the balls of your feet on a step, heels hanging off.",
      "Rise as high as you can and pause at the top.",
      "Lower until you feel a stretch in the calf.",
    ],
  },
  "seated calf raise": {
    category: "legs",
    target: "Calves, soleus especially",
    instructions: [
      "Sit with the pad on your thighs, balls of the feet on the platform.",
      "Push up onto your toes and hold briefly.",
      "Lower slowly through a full stretch.",
    ],
  },

  // Chest
  "barbell bench press": {
    category: "chest",
    target: "Chest, front delts and triceps",
    instructions: [
      "Lie back, shoulder blades pulled together and down, feet planted.",
      "Lower the bar to mid-chest with elbows about 45° from your body.",
      "Press back up in a slight arc toward your shoulders.",
    ],
  },
  "chest press machine": {
    category: "chest",
    target: "Chest and triceps",
    instructions: [
      "Set the seat so the handles sit at mid-chest height.",
      "Press out until your arms are almost straight.",
      "Return slowly until you feel a stretch across the chest.",
    ],
  },
  "dumbbell bench press": {
    category: "chest",
    target: "Chest, front delts and triceps",
    instructions: [
      "Start with the dumbbells at chest height, wrists over elbows.",
      "Press up and slightly together without clashing them.",
      "Lower under control to a comfortable stretch.",
    ],
  },
  "push-ups": {
    category: "chest",
    target: "Chest, triceps and core",
    instructions: [
      "Hands a bit wider than shoulders, body straight from head to heels.",
      "Lower until your chest is just off the floor, elbows tucked ~45°.",
      "Press back up. Drop to your knees if your hips start to sag.",
    ],
  },
  "incline dumbbell press": {
    category: "chest",
    target: "Upper chest and front delts",
    instructions: [
      "Set the bench to 30–45°; any steeper turns it into a shoulder press.",
      "Lower the dumbbells to upper-chest level.",
      "Press up without locking the elbows hard.",
    ],
  },
  "cable fly": {
    category: "chest",
    target: "Chest, especially the inner and lower fibres",
    instructions: [
      "Stand between the cables with a slight forward lean and soft elbows.",
      "Bring your hands together in a wide arc, like hugging a barrel.",
      "Open back up slowly until you feel a chest stretch.",
    ],
  },
  "decline push-ups": {
    category: "chest",
    target: "Upper chest and shoulders",
    instructions: [
      "Put your feet on a bench and hands on the floor.",
      "Lower your chest toward the ground, keeping the body in one line.",
      "Press back up without letting the hips drop.",
    ],
  },

  // Shoulders
  "dumbbell shoulder press": {
    category: "shoulders",
    target: "Shoulders and triceps",
    instructions: [
      "Sit with your back supported, dumbbells at ear height.",
      "Press overhead until the arms are nearly straight.",
      "Lower slowly back to ear height.",
    ],
  },
  "overhead barbell press": {
    category: "shoulders",
    target: "Shoulders, triceps and upper chest",
    instructions: [
      "Bar at collarbone height, grip just outside shoulder width.",
      "Brace your core and press up, moving your head back out of the way.",
      "Lock out overhead with the bar over mid-foot, then lower.",
    ],
  },
  "pike push-ups": {
    category: "shoulders",
    target: "Shoulders and triceps",
    instructions: [
      "From a push-up position, walk your feet in so your hips point up.",
      "Lower the top of your head toward the floor between your hands.",
      "Press back up to the pike position.",
    ],
  },
  "lateral raise": {
    category: "shoulders",
    target: "Side delts",
    instructions: [
      "Stand with light dumbbells at your sides, elbows slightly bent.",
      "Lead with the elbows and raise to shoulder height, no higher.",
      "Lower slowly. Going heavy here just turns it into a shrug.",
    ],
  },
  "cable lateral raise": {
    category: "shoulders",
    target: "Side delts, with tension through the whole range",
    instructions: [
      "Set the pulley low and stand side-on, cable crossing your body.",
      "Raise your arm out to shoulder height, elbow soft.",
      "Resist on the way down.",
    ],
  },
  "face pull": {
    category: "shoulders",
    target: "Rear delts and upper back — good for posture",
    instructions: [
      "Set the rope at face height and step back for tension.",
      "Pull the rope toward your forehead, splitting your hands apart.",
      "Squeeze the rear delts, then return under control.",
    ],
  },
  "rear delt fly": {
    category: "shoulders",
    target: "Rear delts and mid back",
    instructions: [
      "Hinge forward with light dumbbells hanging under your chest.",
      "Raise your arms out to the sides with soft elbows.",
      "Squeeze the shoulder blades, then lower slowly.",
    ],
  },
  "reverse snow angel": {
    category: "shoulders",
    target: "Rear delts and upper back",
    instructions: [
      "Lie face down with your arms by your sides, palms down.",
      "Lift the arms slightly and sweep them overhead in a wide arc.",
      "Sweep back to your sides, keeping the arms off the floor throughout.",
    ],
  },

  // Back
  "lat pulldown": {
    category: "back",
    target: "Lats and biceps",
    instructions: [
      "Grip a bit wider than shoulders, thighs locked under the pad.",
      "Pull the bar to your collarbone, leading with the elbows.",
      "Let it rise slowly until your arms are straight and lats stretch.",
    ],
  },
  "pull-ups (assisted if needed)": {
    category: "back",
    target: "Lats, upper back and biceps",
    instructions: [
      "Hang with an overhand grip just outside shoulder width.",
      "Pull your chest toward the bar, driving the elbows down.",
      "Lower all the way. Use a band or the machine if you need help.",
    ],
  },
  "single-arm dumbbell pullover": {
    category: "back",
    target: "Lats and serratus",
    instructions: [
      "Lie across or along a bench holding one dumbbell over your chest.",
      "Reach it back over your head with a slight elbow bend.",
      "Pull it back over your chest using the lat, not the arm.",
    ],
  },
  "seated cable row": {
    category: "back",
    target: "Mid back, lats and biceps",
    instructions: [
      "Sit tall with a slight knee bend, chest up.",
      "Pull the handle to your stomach, squeezing the shoulder blades.",
      "Extend the arms slowly without rounding your back.",
    ],
  },
  "one-arm dumbbell row": {
    category: "back",
    target: "Lats and mid back, one side at a time",
    instructions: [
      "Brace a hand and knee on a bench, back flat and parallel to the floor.",
      "Row the dumbbell to your hip, elbow close to your body.",
      "Lower to a full stretch. Finish the side, then swap.",
    ],
  },
  "barbell row": {
    category: "back",
    target: "Mid back, lats and rear delts",
    instructions: [
      "Hinge forward to about 45°, back flat, bar hanging at arm's length.",
      "Row the bar to your lower ribs, elbows driving back.",
      "Lower under control without standing up to help it.",
    ],
  },
  "inverted row": {
    category: "back",
    target: "Mid back and biceps",
    instructions: [
      "Set a bar at hip height and hang underneath it, body straight.",
      "Pull your chest to the bar, squeezing the shoulder blades.",
      "Lower slowly. Walk your feet in to make it easier.",
    ],
  },

  // Arms
  "triceps rope pushdown": {
    category: "arms",
    target: "Triceps",
    instructions: [
      "Stand tall at a high pulley, elbows pinned to your sides.",
      "Push down and split the rope apart at the bottom.",
      "Let the rope rise back to chest height, elbows still.",
    ],
  },
  "overhead dumbbell extension": {
    category: "arms",
    target: "Triceps, long head especially",
    instructions: [
      "Hold one dumbbell overhead with both hands, elbows close to your head.",
      "Lower it behind your head until you feel a triceps stretch.",
      "Press back up without flaring the elbows out.",
    ],
  },
  "skull crusher": {
    category: "arms",
    target: "Triceps",
    instructions: [
      "Lie down with the weight held over your chest, arms straight.",
      "Bend at the elbows to lower it toward your forehead.",
      "Extend back up, keeping the upper arms still.",
    ],
  },
  "diamond push-ups": {
    category: "arms",
    target: "Triceps and inner chest",
    instructions: [
      "Hands together under your chest, index fingers and thumbs touching.",
      "Lower with your elbows tracking close to your ribs.",
      "Press back up. Knees down if your form breaks.",
    ],
  },
  "barbell curl": {
    category: "arms",
    target: "Biceps",
    instructions: [
      "Stand with the bar at thigh height, underhand grip, elbows at your sides.",
      "Curl up without swinging your torso or letting the elbows drift.",
      "Lower slowly to a full stretch.",
    ],
  },
  "dumbbell hammer curl": {
    category: "arms",
    target: "Biceps and forearms",
    instructions: [
      "Hold the dumbbells with your palms facing in, thumbs up.",
      "Curl up keeping that neutral grip the whole way.",
      "Lower under control.",
    ],
  },
  "incline dumbbell curl": {
    category: "arms",
    target: "Biceps, with a big stretch at the bottom",
    instructions: [
      "Sit back on an incline bench, arms hanging straight down.",
      "Curl up without letting the elbows travel forward.",
      "Lower all the way until the biceps stretch.",
    ],
  },
  "towel curl": {
    category: "arms",
    target: "Biceps and grip",
    instructions: [
      "Loop a towel under your feet and hold an end in each hand.",
      "Curl up while pulling the towel apart for tension.",
      "Resist on the way down.",
    ],
  },

  // Core
  plank: {
    category: "core",
    target: "Deep core, shoulders and glutes",
    instructions: [
      "Forearms under your shoulders, body straight from head to heels.",
      "Squeeze the glutes and brace as if about to be poked in the stomach.",
      "Hold for time, breathing normally. Don't let the hips sag or spike.",
    ],
  },
  "hanging knee raise": {
    category: "core",
    target: "Lower abs and hip flexors",
    instructions: [
      "Hang from a bar with your shoulders active, not fully relaxed.",
      "Raise your knees toward your chest, curling the pelvis up slightly.",
      "Lower slowly without swinging.",
    ],
  },
  "dead bug": {
    category: "core",
    target: "Deep core and anti-rotation control",
    instructions: [
      "Lie on your back, arms up and knees over hips at 90°.",
      "Lower one arm and the opposite leg toward the floor, low back flat.",
      "Return and alternate sides slowly.",
    ],
  },
  "cable woodchopper": {
    category: "core",
    target: "Obliques and rotational core",
    instructions: [
      "Set the pulley high and stand side-on, arms extended.",
      "Rotate through your torso and pull down across the body to the opposite hip.",
      "Return slowly. Finish the side, then swap.",
    ],
  },

  // Cardio
  "treadmill walk (incline)": {
    category: "cardio",
    target: "Heart and lungs, plus calves and glutes",
    instructions: [
      "Set a 6–12% incline at a brisk pace you can still talk at.",
      "Stand tall and avoid holding the rails.",
      "Keep the effort steady for the full time.",
    ],
  },
  cycle: {
    category: "cardio",
    target: "Heart and lungs, quads and calves",
    instructions: [
      "Set the seat so your knee is slightly bent at the bottom of the stroke.",
      "Hold a steady pace you could sustain in conversation.",
      "Keep your upper body relaxed.",
    ],
  },
  "skipping / jogging": {
    category: "cardio",
    target: "Heart and lungs, calves and coordination",
    instructions: [
      "Stay light on the balls of your feet with small, quick bounces.",
      "Keep your elbows in and turn the rope with your wrists.",
      "Swap to jogging on the spot if the rope trips you up.",
    ],
  },

  // Warm-up
  "arm circles": {
    category: "warmup",
    target: "Shoulders and upper back — wakes up the joints",
    instructions: [
      "Stand with your arms straight out to the sides.",
      "Make small circles forward, growing bigger for 15 seconds.",
      "Reverse the direction for another 15 seconds.",
    ],
  },
  "leg swings": {
    category: "warmup",
    target: "Hips, hamstrings and glutes",
    instructions: [
      "Hold a rack or wall for balance, standing on one leg.",
      "Swing the other leg forward and back, relaxed, not forced.",
      "Do 10–12 per leg, then swing side to side.",
    ],
  },
  "air squat": {
    category: "warmup",
    target: "Hips, knees and ankles",
    instructions: [
      "Feet shoulder width, arms out in front.",
      "Squat down slowly to a comfortable depth and stand back up.",
      "Go a little deeper with each rep as things loosen up.",
    ],
  },
  "hip circles": {
    category: "warmup",
    target: "Hip joints and glutes",
    instructions: [
      "Stand on one leg, holding support, and lift the other knee to hip height.",
      "Draw big circles with the knee, opening the hip out and back.",
      "10 each direction, then swap legs.",
    ],
  },
  "jumping jacks": {
    category: "warmup",
    target: "Whole body — raises heart rate and body temperature",
    instructions: [
      "Start with feet together, arms at your sides.",
      "Jump the feet wide while sweeping your arms overhead.",
      "Jump back in. Keep it light and continuous.",
    ],
  },
  "band pull-apart": {
    category: "warmup",
    target: "Rear delts and upper back — preps pressing and pulling",
    instructions: [
      "Hold a light band at shoulder height, arms straight in front.",
      "Pull it apart until your arms are out wide, squeezing the shoulder blades.",
      "Return slowly under control.",
    ],
  },
  "cat-cow": {
    category: "warmup",
    target: "Spine mobility, from the neck to the lower back",
    instructions: [
      "On hands and knees, wrists under shoulders and knees under hips.",
      "Round your back up and tuck the chin, then reverse into a gentle arch.",
      "Move slowly with your breath for 8–10 rounds.",
    ],
  },
  "inchworm walkout": {
    category: "warmup",
    target: "Hamstrings, shoulders and core",
    instructions: [
      "From standing, hinge and put your hands on the floor.",
      "Walk them out to a plank, pause, then walk them back.",
      "Stand up tall and repeat.",
    ],
  },
  "high knees": {
    category: "warmup",
    target: "Hip flexors, calves and heart rate",
    instructions: [
      "Jog on the spot, driving each knee up to hip height.",
      "Stay on the balls of your feet and pump the arms.",
      "Keep it going for 20–30 seconds.",
    ],
  },
  "shoulder dislocates": {
    category: "warmup",
    target: "Shoulder mobility through a full overhead range",
    instructions: [
      "Hold a band or broomstick wide with straight arms in front of you.",
      "Raise it overhead and as far behind you as comfort allows.",
      "Bring it back the same way. Widen your grip if it pinches.",
    ],
  },

  // Cool-down
  "standing quad stretch": {
    category: "stretch",
    target: "Quads and hip flexors",
    instructions: [
      "Hold support, bend one knee and take that ankle behind you.",
      "Keep the knees together and push the hip forward gently.",
      "Hold 30 seconds, then swap sides.",
    ],
  },
  "seated hamstring stretch": {
    category: "stretch",
    target: "Hamstrings and lower back",
    instructions: [
      "Sit with one leg straight and the other tucked in.",
      "Hinge forward from the hips over the straight leg, back long.",
      "Hold 30 seconds per side, breathing out into the stretch.",
    ],
  },
  "doorway chest stretch": {
    category: "stretch",
    target: "Chest and front delts",
    instructions: [
      "Put your forearm on a doorframe with the elbow at shoulder height.",
      "Step through gently until you feel a stretch across the chest.",
      "Hold 30 seconds per side.",
    ],
  },
  "child's pose": {
    category: "stretch",
    target: "Lower back, lats and hips",
    instructions: [
      "Kneel and sit your hips back onto your heels.",
      "Reach your arms forward and let your chest sink toward the floor.",
      "Hold for 45–60 seconds, breathing slowly.",
    ],
  },
  "cross-body shoulder stretch": {
    category: "stretch",
    target: "Rear delts and upper back",
    instructions: [
      "Bring one arm straight across your chest.",
      "Use the other arm to pull it in gently, keeping the shoulder down.",
      "Hold 30 seconds per side.",
    ],
  },
  "figure-four glute stretch": {
    category: "stretch",
    target: "Glutes and outer hip",
    instructions: [
      "Lie on your back and cross one ankle over the opposite knee.",
      "Pull the bottom thigh toward your chest until the glute stretches.",
      "Hold 30 seconds per side.",
    ],
  },
  "triceps overhead stretch": {
    category: "stretch",
    target: "Triceps and lats",
    instructions: [
      "Reach one arm overhead and bend the elbow so the hand drops behind you.",
      "Use the other hand to ease the elbow back gently.",
      "Hold 30 seconds per side.",
    ],
  },
  "cobra stretch": {
    category: "stretch",
    target: "Abs, hip flexors and chest",
    instructions: [
      "Lie face down with your hands under your shoulders.",
      "Press your chest up, keeping the hips on the floor and shoulders relaxed.",
      "Hold 30 seconds without cranking the lower back.",
    ],
  },
  "calf stretch on wall": {
    category: "stretch",
    target: "Calves and Achilles",
    instructions: [
      "Put the ball of one foot against a wall with the heel on the floor.",
      "Lean in until you feel the calf stretch.",
      "Hold 30 seconds per side.",
    ],
  },
  "wall biceps stretch": {
    category: "stretch",
    target: "Biceps, forearms and front of the shoulder",
    instructions: [
      "Put your palm flat on a wall behind you at shoulder height, fingers back.",
      "Turn your body slowly away from the wall until the biceps stretch.",
      "Hold 30 seconds per side.",
    ],
  },
  "lat stretch": {
    category: "stretch",
    target: "Lats and shoulders",
    instructions: [
      "Hold a rack, bench or doorframe at about hip height and step back.",
      "Let your chest sink between your arms.",
      "Hold 30–45 seconds, breathing into the ribs.",
    ],
  },
};

export const EXERCISE_LIBRARY = L;

const key = (name: string) => name.trim().toLowerCase();

// Keyword fallback so hand-typed exercises still get a sensible icon.
// Order matters: "leg curl" is legs, "bicycle crunch" is core.
const PREP_WORDS: [RegExp, ExerciseCategory][] = [
  [/stretch|mobility|yoga|\bpose\b|cool ?down/, "stretch"],
  [/warm ?up|circles?\b|(leg|arm) swings?|jumping jack|high knee|inchworm|cat-cow/, "warmup"],
];
const BODY_WORDS: [RegExp, ExerciseCategory][] = [
  [/core|\babs?\b|plank|crunch|sit-?up|oblique|dead bug|hollow|russian twist|(leg|knee) raise/, "core"],
  [/cardio|\brun|jog|treadmill|cycl|bike|elliptical|stair|skip|rowing machine|rower/, "cardio"],
  [/glute|hip thrust|hip extension|bridge|romanian|\brdl\b|stiff-?leg|good morning|kickback/, "glutes"],
  [/quad|hamstring|\blegs?\b|squat|lunge|calf|calves|step-?up/, "legs"],
  [/chest|\bpecs?\b|bench|incline|\bfly|flye|push-?up|\bdips?\b/, "chest"],
  [/\blats?\b|back|\brows?\b|pull-?up|chin-?up|pulldown|deadlift|shrug|\btraps?\b/, "back"],
  [/shoulder|delt|overhead press|military|face pull|raise/, "shoulders"],
  [/bicep|tricep|curl|pushdown|skull|extension|\barms?\b|forearm/, "arms"],
];

const firstMatch = (text: string, words: [RegExp, ExerciseCategory][]) =>
  words.find(([pattern]) => pattern.test(text))?.[1];

export function categoryFromExercise(
  name: string,
  muscle?: string | null,
  phase?: Phase | null,
): ExerciseCategory {
  const entry = L[key(name)];
  if (entry) return entry.category;
  // The icon matches the section it sits in
  if (phase === "warmup") return "warmup";
  if (phase === "cooldown") return "stretch";
  const title = name.toLowerCase();
  // What you said it works beats guessing from the name
  return (
    firstMatch(title, PREP_WORDS) ??
    (muscle ? firstMatch(muscle.toLowerCase(), BODY_WORDS) : undefined) ??
    firstMatch(title, BODY_WORDS) ??
    "general"
  );
}

export function getExerciseInfo(
  name: string,
  muscle?: string | null,
  phase?: Phase | null,
): ExerciseInfo {
  const entry = L[key(name)];
  if (entry) return entry;
  const category = categoryFromExercise(name, muscle, phase);
  return {
    category,
    target: muscle?.trim() || "Not recorded for this exercise",
    instructions: [],
  };
}
