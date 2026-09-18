import { type Frame, type Joints, type Prop, type Pt, type Scene, cable, handMid, n, plate, weight } from "./rig";

const hN = (j: Joints) => j.hN;
const hF = (j: Joints) => j.hF;

// A lat-pulldown bar, ends bent down
const latBar: Prop = {
  type: "path",
  d: (j) => {
    const [l, r] = j.hF[0] < j.hN[0] ? [j.hF, j.hN] : [j.hN, j.hF];
    return `M${n(l[0] - 9)} ${n(l[1] + 3)}L${n(l[0] - 6)} ${n(l[1])}L${n(r[0] + 6)} ${n(r[1])}L${n(r[0] + 9)} ${n(r[1] + 3)}`;
  },
};

const seatFront: Frame = { at: [60, 56], t: 0, fN: [70, 72], fF: [50, 72], kb: [1, -1] };
export const pulldown: Scene = {
  view: "front",
  dur: 3.2,
  work: ["torso", "armN", "armF"],
  scenery: "M50 50H70M50 58H70M60 58V72",
  props: [cable([60, 0], handMid), latBar],
  frames: [
    { ...seatFront, hN: [74, 15], hF: [46, 15], eb: [-1, 1], hold: 0.25, move: 0.9 },
    { ...seatFront, hN: [76, 31], hF: [44, 31], eb: [-1, 1], hold: 0.3, move: 1.2 },
  ],
};

export const pullUp: Scene = {
  view: "front",
  dur: 3.4,
  ground: false,
  work: ["torso", "armN", "armF"],
  scenery: "M28 8H92",
  frames: [
    { at: [60, 49.5], t: 0, hN: [72, 8], hF: [48, 8], fN: [62.5, 78], fF: [57.5, 78], eb: [-1, 1], hold: 0.3, move: 1 },
    { at: [60, 35], t: 0, hN: [72, 8], hF: [48, 8], fN: [62.5, 63.5], fF: [57.5, 63.5], eb: [-1, 1], hold: 0.25, move: 1.3 },
  ],
};

const rowSeat = (t: number, hand: Pt): Frame => ({ at: [44, 60], t, h: t * 0.5, fN: [70, 64], fF: [70, 64], hN: hand, hF: hand });
export const rowSeated: Scene = {
  dur: 3.2,
  work: ["torso", "armN", "armF"],
  scenery: "M34 62H54M44 62V72M74 56V70",
  props: [cable([104, 46], hN), weight(hN, 2.2)],
  frames: [
    { ...rowSeat(18, [71, 45]), hold: 0.2, move: 1 },
    { ...rowSeat(-4, [48, 48]), hold: 0.35, move: 1.2 },
  ],
};

const hinged = (hand: Pt, extra: Partial<Frame> = {}): Frame => ({
  at: [58, 72], anchor: "footN", t: 70, h: 55, ln: [155, 185], hN: hand, hF: hand, ...extra,
});

export const rowBent: Scene = {
  dur: 3,
  work: ["torso", "armN", "armF"],
  props: [plate(hN, 5)],
  frames: [
    { ...hinged([73, 58]), hold: 0.2, move: 0.9 },
    { ...hinged([64, 44]), hold: 0.3, move: 1.1 },
  ],
};

export const rowOneArm: Scene = {
  dur: 3,
  work: ["torso", "armN"],
  scenery: "M74 61H96M78 61V72M92 61V72",
  props: [weight(hN, 3)],
  frames: [
    { ...hinged([73, 58], { hF: [80, 61], lf: [200, 185] }), hold: 0.2, move: 0.9 },
    { ...hinged([64, 44], { hF: [80, 61], lf: [200, 185] }), hold: 0.3, move: 1.1 },
  ],
};

const incline = (t: number, eb: [number, number]): Frame => ({
  at: [31, 71], anchor: "footN", t, h: t, ln: [t + 180, t + 180], hN: [78, 40], hF: [78, 40], eb,
});
export const invertedRow: Scene = {
  dur: 3,
  work: ["torso", "armN", "armF"],
  scenery: "M70 40H86M84 40V72",
  frames: [
    { ...incline(79.2, [1, 1]), hold: 0.2, move: 0.9 },
    { ...incline(62.9, [1, 1]), hold: 0.3, move: 1.1 },
  ],
};

const lyingBack: Frame = { at: [74, 52], t: -90, h: -90, fN: [90, 72], fF: [90, 72] };
export const pullover: Scene = {
  dur: 3.4,
  work: ["torso", "armN"],
  scenery: "M36 55H84M42 55V72M78 55V72",
  props: [weight(hN, 3.4)],
  frames: [
    { ...lyingBack, an: [0, 0], hold: 0.25, move: 1.3 },
    { ...lyingBack, an: [-100, -95], hold: 0.15, move: 1 },
  ],
};

const facing: Frame = { at: [56, 43.5], t: -4, h: 0, fN: [60, 72], fF: [52, 72] };
export const facePull: Scene = {
  dur: 3,
  work: ["armN", "armF"],
  props: [cable([106, 18], hN), weight(hN, 2)],
  frames: [
    { ...facing, hN: [76, 20], hF: [76, 20], eb: [1, 1], hold: 0.2 },
    { ...facing, hN: [62, 16], hF: [62, 16], eb: [1, 1], hold: 0.35 },
  ],
};

const bentFront: Frame = { at: [60, 44], t: 0, h: 180, tl: 10, fN: [64, 72], fF: [56, 72], eb: [1, -1] };
export const rearFly: Scene = {
  view: "front",
  dur: 3,
  work: ["armN", "armF"],
  props: [weight(hN, 2.6), weight(hF, 2.6)],
  frames: [
    { ...bentFront, hN: [63, 56], hF: [57, 56], hold: 0.2, move: 1 },
    { ...bentFront, hN: [86, 36], hF: [34, 36], hold: 0.3, move: 1.2 },
  ],
};

// Seen from above, lying face down
export const snowAngel: Scene = {
  view: "front",
  dur: 3.6,
  ground: false,
  work: ["armN", "armF"],
  scenery: "M6 42H114M6 78H114",
  frames: [
    { at: [40, 60], t: 90, h: 90, ln: [-90, -90], an: [-100, -100], af: [-80, -80], hold: 0.2 },
    { at: [40, 60], t: 90, h: 90, ln: [-90, -90], an: [-260, -260], af: [80, 80], hold: 0.3 },
  ],
};

const standing: Frame = { at: [58, 43.5], t: 0, fN: [58, 72], fF: [58, 72] };
export const curl: Scene = {
  dur: 2.8,
  work: ["armN"],
  props: [weight(hN, 3)],
  frames: [
    { ...standing, an: [180, 180], af: [180, 180], hold: 0.15, move: 0.9 },
    { ...standing, an: [178, 20], af: [180, 180], hold: 0.35, move: 1.2 },
  ],
};

const inclineSeat: Frame = { at: [52, 58], t: -40, h: -20, fN: [70, 72], fF: [70, 72] };
export const inclineCurl: Scene = {
  dur: 3,
  work: ["armN"],
  scenery: "M49.3 60.3L33.9 41.9M46 60.3H64M54 60.5V72",
  props: [weight(hN, 3)],
  frames: [
    { ...inclineSeat, an: [180, 180], hold: 0.2, move: 0.9 },
    { ...inclineSeat, an: [180, 30], hold: 0.35, move: 1.3 },
  ],
};

const leaning: Frame = { at: [58, 43.5], t: 6, h: 0, fN: [60, 72], fF: [56, 72] };
export const pushdown: Scene = {
  dur: 2.8,
  work: ["armN", "armF"],
  props: [cable([82, 3], hN), weight(hN, 2)],
  frames: [
    { ...leaning, an: [180, 40], hold: 0.15, move: 0.9 },
    { ...leaning, an: [180, 180], hold: 0.35, move: 1.2 },
  ],
};

const benchSit: Frame = { at: [58, 56], t: 0, fN: [72, 72], fF: [70, 72] };
export const overheadExtension: Scene = {
  dur: 3,
  work: ["armN", "armF"],
  scenery: "M48 58H68M58 58V72",
  props: [weight(hN, 3.4)],
  frames: [
    { ...benchSit, an: [10, 200], hold: 0.15, move: 0.9 },
    { ...benchSit, an: [10, 365], hold: 0.35, move: 1.3 },
  ],
};

const lyingBench: Frame = { at: [72, 52], t: -90, h: -90, fN: [88, 72], fF: [88, 72] };
export const skullCrusher: Scene = {
  dur: 3,
  work: ["armN", "armF"],
  scenery: "M30 55H78M36 55V72M72 55V72",
  props: [plate(hN, 4)],
  frames: [
    { ...lyingBench, an: [-10, -10], hold: 0.3, move: 1.3 },
    { ...lyingBench, an: [-10, -150], hold: 0.15, move: 0.9 },
  ],
};

