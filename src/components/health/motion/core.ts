import { type Frame, type Joints, type Pt, type Scene, add, cable, handMid, pt } from "./rig";

const plankAt = (t: number): Frame => ({ at: [26, 71], anchor: "footN", t, h: t, ln: [t + 180, t + 180], hN: [84.8, 71], hF: [84.8, 71] });
export const plank: Scene = {
  dur: 3.6,
  work: ["torso"],
  frames: [
    { ...plankAt(77.2), hold: 0.8 },
    { ...plankAt(76.4), hold: 0.8 },
  ],
};

const back: Frame = { at: [62, 68], t: -90, h: -90 };
export const deadBug: Scene = {
  dur: 4,
  work: ["torso"],
  frames: [
    { ...back, an: [0, 0], af: [0, 0], ln: [0, 90], lf: [0, 90], hold: 0.2 },
    { ...back, an: [-80, -80], af: [0, 0], ln: [0, 90], lf: [80, 80], hold: 0.35 },
    { ...back, an: [0, 0], af: [0, 0], ln: [0, 90], lf: [0, 90], hold: 0.2 },
    { ...back, an: [0, 0], af: [-80, -80], ln: [80, 80], lf: [0, 90], hold: 0.35 },
  ],
};

export const crunch: Scene = {
  dur: 2.8,
  work: ["torso"],
  frames: [
    { ...back, an: [-60, 150], fN: [76, 72], fF: [76, 72], hold: 0.15 },
    { ...back, t: -62, h: -40, spine: -4, an: [-35, 175], fN: [76, 72], fF: [76, 72], hold: 0.35 },
  ],
};

const hang = (t: number, ln: [number, number]): Frame => ({ at: [60, 8], anchor: "handN", an: [0, 0], t, h: 40, ln });
export const kneeRaise: Scene = {
  dur: 3,
  ground: false,
  work: ["torso"],
  scenery: "M44 8H76",
  frames: [
    { ...hang(0, [180, 180]), hold: 0.25, move: 0.9 },
    { ...hang(-8, [90, 180]), hold: 0.3, move: 1.2 },
  ],
};

const wide: Frame = { at: [60, 43.5], t: 0, fN: [68, 72], fF: [52, 72] };
export const woodchop: Scene = {
  view: "front",
  dur: 3,
  work: ["torso"],
  props: [cable([102, 6], handMid)],
  frames: [
    { ...wide, t: 8, hN: [80, 16], hF: [78, 17], eb: [-1, 1], hold: 0.2, move: 0.9 },
    { ...wide, t: -10, hN: [44, 50], hF: [46, 49], eb: [-1, 1], hold: 0.3, move: 1.2 },
  ],
};

// Walking uphill on a treadmill: two steps
const stride = (ln: [number, number], lf: [number, number], an: [number, number], af: [number, number]): Frame => ({
  at: [60, 38], t: 8, h: 4, ln, lf, an, af,
});
export const walkIncline: Scene = {
  dur: 1.8,
  work: ["legN", "legF"],
  scenery: "M20 71.5L98 61.5M92 62L99 30M96 30H106",
  frames: [
    stride([160, 170], [200, 195], [200, 170], [160, 130]),
    stride([180, 188], [165, 205], [180, 160], [180, 160]),
    stride([200, 195], [160, 170], [160, 130], [200, 170]),
    stride([165, 205], [180, 188], [180, 160], [180, 160]),
  ],
};

const CRANK: Pt = [62, 62];
const pedal = (deg: number): Pt => add(CRANK, deg, 6);
export const cycle: Scene = {
  dur: 1.6,
  linear: true,
  work: ["legN", "legF"],
  scenery: "M28 62a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M76 62a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M38 62L50 46H74L86 62M50 46L62 62L74 46M46 43.5H55M74 46L77 36",
  props: [
    { type: "path", faint: true, width: 1.8, d: (j: Joints) => `M${pt(CRANK)}L${pt(j.fF)}` },
    { type: "path", width: 1.8, d: (j: Joints) => `M${pt(CRANK)}L${pt(j.fN)}` },
  ],
  frames: Array.from({ length: 8 }, (_, i): Frame => ({
    at: [51, 42.5],
    t: 40,
    h: 55,
    hN: [76, 36],
    hF: [76, 36],
    fN: pedal(i * 45),
    fF: pedal(i * 45 + 180),
  })),
};

// Skipping: the rope's far point turns around the body (k = angle)
const ROPE_CENTER: Pt = [60, 40];
const hop = (k: number, hip: number, foot: number): Frame => ({
  at: [60, hip], t: 0, k, fN: [60, foot], fF: [59, foot], hN: [66, hip + 1], hF: [65, hip + 1], eb: [-1, -1],
});
export const skipRope: Scene = {
  dur: 1.1,
  linear: true,
  work: ["legN", "legF"],
  props: [
    {
      type: "path",
      width: 1.4,
      d: (j: Joints) => {
        const far = add(ROPE_CENTER, j.k, 33);
        const lag = add(ROPE_CENTER, j.k - 55, 36);
        return `M${pt(j.hN)}Q${pt(lag)} ${pt(far)}`;
      },
    },
  ],
  frames: [
    hop(0, 44.5, 72),
    hop(90, 42, 70.5),
    hop(180, 39.5, 67.5),
    hop(270, 42, 70.5),
    { ...hop(360, 44.5, 72), move: 0.001 },
  ],
};
