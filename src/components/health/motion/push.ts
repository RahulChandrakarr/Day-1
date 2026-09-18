import { type Frame, type Pt, type Scene, barFront, cable, plate, weight } from "./rig";

const hN = (j: { hN: Pt }) => j.hN;
const hF = (j: { hF: Pt }) => j.hF;
const both = (r: number): Scene["props"] => [weight(hF, r), weight(hN, r)];

const lying: Frame = { at: [72, 52], t: -90, h: -90, fN: [88, 72], fF: [88, 72] };
const bench = "M30 55H78M36 55V72M72 55V72";

function press(props: Scene["props"]): Scene {
  return {
    dur: 3.2,
    work: ["armN", "armF", "torso"],
    scenery: bench,
    props,
    frames: [
      { ...lying, hN: [51, 31], hF: [51, 31], hold: 0.3, move: 1.2 },
      { ...lying, hN: [52, 45], hF: [52, 45], hold: 0.15, move: 0.9 },
    ],
  };
}

export const benchBar = press([plate(hN, 5.5)]);
export const benchDumbbell = press([weight(hN, 3.2)]);

const incline: Frame = { at: [60, 58], t: -50, h: -30, fN: [76, 72], fF: [76, 72] };
export const inclinePress: Scene = {
  dur: 3.2,
  work: ["armN", "armF", "torso"],
  scenery: "M57.8 60.7L38.6 44.6M52 60.7H70M60 61V72",
  props: [weight(hN, 3.2)],
  frames: [
    { ...incline, hN: [46, 23.5], hF: [46, 23.5], hold: 0.3, move: 1.2 },
    { ...incline, hN: [47, 37], hF: [47, 37], hold: 0.15, move: 0.9 },
  ],
};

const seatedPress: Frame = { at: [50, 56], t: -6, h: 0, fN: [64, 72], fF: [64, 72] };
export const chestPress: Scene = {
  dur: 3,
  work: ["armN", "armF", "torso"],
  scenery: "M45 58L42 32M44 58H60M52 58V72",
  props: [weight(hN, 2.4)],
  frames: [
    { ...seatedPress, hN: [56, 36], hF: [56, 36], hold: 0.2 },
    { ...seatedPress, hN: [68, 36], hF: [68, 36], hold: 0.3 },
  ],
};

function pushup(foot: Pt, top: number, bottom: number, hand: Pt, extra: Partial<Frame> = {}, scenery?: string): Scene {
  const at = (t: number): Frame => ({ at: foot, anchor: "footN", t, h: t, ln: [t + 180, t + 180], hN: hand, hF: hand, ...extra });
  return {
    dur: 2.8,
    work: ["armN", "armF", "torso"],
    scenery,
    frames: [
      { ...at(top), hold: 0.25, move: 1.1 },
      { ...at(bottom), hold: 0.1, move: 0.8 },
    ],
  };
}

export const pushUp = pushup([25.2, 70.4], 65, 78, [70, 71]);
export const pushUpDecline = pushup([22, 56], 82.6, 95, [71.5, 71], {}, "M12 58H30M15 58V72M27 58V72");

export const pikePushUp: Scene = {
  dur: 3,
  work: ["armN", "armF"],
  frames: [
    { at: [34, 71], anchor: "footN", ln: [190, 190], t: 125, h: 125, hN: [70, 71], hF: [70, 71], eb: [1, 1], hold: 0.25, move: 1.1 },
    { at: [34, 71], anchor: "footN", ln: [205, 205], t: 150, h: 150, hN: [70, 71], hF: [70, 71], eb: [1, 1], hold: 0.1, move: 0.8 },
  ],
};

const upright = (x = 60): Frame => ({ at: [x, 43.5], t: 0, fN: [x + 3.5, 72], fF: [x - 3.5, 72] });

export const cableFly: Scene = {
  view: "front",
  dur: 3.2,
  work: ["torso", "armN", "armF"],
  props: [cable([100, 6], hN), cable([20, 6], hF), weight(hN, 2.2), weight(hF, 2.2)],
  frames: [
    { ...upright(), hN: [84, 26], hF: [36, 26], al: 0.9, eb: [1, -1], hold: 0.2, move: 0.6 },
    { ...upright(), hN: [68, 26.5], hF: [52, 26.5], al: 0.22, eb: [1, -1], move: 0.5 },
    { ...upright(), hN: [61, 31.5], hF: [59, 31.5], al: 0.42, eb: [1, -1], hold: 0.35, move: 0.5 },
    { ...upright(), hN: [68, 26.5], hF: [52, 26.5], al: 0.22, eb: [1, -1], move: 0.6 },
  ],
};

export const overheadPress: Scene = {
  view: "front",
  dur: 3.2,
  work: ["armN", "armF"],
  props: [barFront],
  frames: [
    { ...upright(), hN: [70, 24], hF: [50, 24], eb: [-1, 1], hold: 0.25 },
    { ...upright(), hN: [67.5, 5.5], hF: [52.5, 5.5], eb: [-1, 1], hold: 0.3 },
  ],
};

const seatedFront: Frame = { at: [60, 55], t: 0, fN: [68, 72], fF: [52, 72], kb: [1, -1] };
export const shoulderPress: Scene = {
  view: "front",
  dur: 3.2,
  work: ["armN", "armF"],
  scenery: "M48 58H72M60 58V72",
  props: both(3),
  frames: [
    { ...seatedFront, hN: [72, 34], hF: [48, 34], eb: [-1, 1], hold: 0.25 },
    { ...seatedFront, hN: [66, 14.5], hF: [54, 14.5], eb: [-1, 1], hold: 0.3 },
  ],
};

export const lateralRaise: Scene = {
  view: "front",
  dur: 3,
  work: ["armN", "armF"],
  props: both(2.8),
  frames: [
    { ...upright(), hN: [68, 43], hF: [52, 43], eb: [1, -1], hold: 0.25, move: 1 },
    { ...upright(), hN: [86, 25], hF: [34, 25], eb: [1, -1], hold: 0.3, move: 1.2 },
  ],
};

export const lateralCable: Scene = {
  ...lateralRaise,
  props: [cable([52, 71], hN), weight(hN, 2.2)],
  frames: lateralRaise.frames.map((f) => ({ ...f, hF: [54, 40] })),
};

export const tricepsDip: Scene = {
  dur: 2.8,
  work: ["armN", "armF"],
  scenery: "M44 50H60M52 50V72",
  frames: [
    { at: [58, 50], anchor: "handN", t: -3, an: [185, 185], fN: [86, 71], fF: [86, 71], hF: [58, 50], hold: 0.2 },
    { at: [58, 50], anchor: "handN", t: -5, an: [235, 135], fN: [86, 71], fF: [86, 71], hF: [58, 50], hold: 0.15 },
  ],
};

