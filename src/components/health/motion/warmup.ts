import { type Frame, type Joints, type Pt, type Scene, add, pt, weight } from "./rig";

export const jumpingJack: Scene = {
  view: "front",
  dur: 1.3,
  frames: [
    { at: [60, 43.5], t: 0, fN: [62, 72], fF: [58, 72], an: [175, 175], af: [185, 185], hold: 0.1 },
    { at: [60, 41], t: 0, fN: [72, 70.5], fF: [48, 70.5], an: [22, 14], af: [338, 346], hold: 0.1 },
  ],
};

// Straight arms; the hands trace small circles, so the arm looks shorter
// as it swings toward the viewer
function circleArm(deg: number): Frame {
  const [x, y] = add([18, 0], deg, 3.5);
  const angle = (Math.atan2(x, -y) * 180) / Math.PI;
  return {
    at: [60, 43.5], t: 0, fN: [63, 72], fF: [57, 72],
    an: [angle, angle], af: [-angle, -angle], al: Math.hypot(x, y) / 21.5,
  };
}
export const armCircles: Scene = {
  view: "front",
  dur: 1.2,
  linear: true,
  frames: Array.from({ length: 12 }, (_, i) => circleArm(i * 30)),
};

const wall = "M86 16V72";
export const legSwings: Scene = {
  dur: 1.8,
  work: ["legN"],
  scenery: wall,
  frames: [
    { at: [64, 43.5], t: -4, ln: [122, 128], fF: [64, 72], hF: [85, 30], an: [200, 170], hold: 0.05 },
    { at: [64, 43.5], t: 6, ln: [215, 208], fF: [64, 72], hF: [85, 30], an: [160, 150], hold: 0.05 },
  ],
};

const hipsFront: Frame = { at: [60, 43.5], t: 0, fF: [57, 72], hN: [66, 43], hF: [54, 43], eb: [1, -1], kb: [1, 1] };
export const hipCircles: Scene = {
  view: "front",
  dur: 2.6,
  work: ["legN"],
  frames: [
    { ...hipsFront, fN: [63, 72] },
    { ...hipsFront, fN: [65, 58] },
    { ...hipsFront, fN: [82, 57], hold: 0.1 },
  ],
};

const bent = (upper: number, fore: number): [number, number] => [upper, fore];
export const highKnees: Scene = {
  dur: 0.9,
  work: ["legN", "legF"],
  frames: [
    { at: [60, 42], t: 2, ln: [92, 185], lf: [182, 180], an: bent(205, 150), af: bent(150, 60) },
    { at: [60, 42], t: 2, ln: [182, 180], lf: [92, 185], an: bent(150, 60), af: bent(205, 150) },
  ],
};

const fours = (spine: number, h: number): Frame => ({
  at: [26, 71], anchor: "footN", ln: [180, -90], t: 70, h, spine, hN: [59.7, 71], hF: [59.7, 71],
});
export const catCow: Scene = {
  dur: 3.6,
  work: ["torso"],
  frames: [
    { ...fours(-6, 150), hold: 0.5 },
    { ...fours(5, 40), hold: 0.5 },
  ],
};

const worm = (ln: number, t: number, hand: Pt, extra: Partial<Frame> = {}): Frame => ({
  at: [30, 72], anchor: "footN", ln: [ln, ln], t, h: t, hN: hand, hF: hand, ...extra,
});
export const inchworm: Scene = {
  dur: 5.4,
  frames: [
    worm(180, 0, [31, 44], { hold: 0.2 }),
    worm(183, 135, [50, 71]),
    worm(205, 140, [66, 71]),
    worm(245, 65, [75, 71.5], { hold: 0.4 }),
    worm(205, 140, [66, 71]),
    worm(183, 135, [50, 71]),
  ],
};

const band = { type: "path" as const, width: 1.8, d: (j: Joints) => `M${pt(j.hF)}L${pt(j.hN)}` };
export const bandPullApart: Scene = {
  view: "front",
  dur: 2.2,
  work: ["armN", "armF"],
  props: [band],
  frames: [
    { at: [60, 43.5], t: 0, fN: [63, 72], fF: [57, 72], hN: [65.5, 24], hF: [54.5, 24], al: 0.08, eb: [1, -1], hold: 0.15 },
    { at: [60, 43.5], t: 0, fN: [63, 72], fF: [57, 72], hN: [87, 24], hF: [33, 24], al: 1, eb: [1, -1], hold: 0.3 },
  ],
};

export const shoulderDislocates: Scene = {
  dur: 3.2,
  props: [weight((j) => j.hN, 2)],
  frames: [
    { at: [60, 43.5], t: 0, fN: [60, 72], fF: [60, 72], an: [160, 160], hold: 0.15 },
    { at: [60, 43.5], t: 0, fN: [60, 72], fF: [60, 72], an: [-160, -160], hold: 0.15 },
  ],
};
