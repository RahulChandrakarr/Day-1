import { type Frame, type Pt, type Scene, add, behindNeck, plate, pt, weight } from "./rig";

const FOOT: Pt = [60, 72];
const hands = (j: { hN: Pt }) => j.hN;

function squat(up: Partial<Frame>, down: Partial<Frame>, props: Scene["props"] = []): Scene {
  return {
    dur: 3.4,
    work: ["legN", "legF"],
    props,
    frames: [
      { at: FOOT, anchor: "footN", t: 4, h: 0, ln: [180, 180], hold: 0.35, move: 1.3, ...up },
      { at: FOOT, anchor: "footN", t: 40, h: 22, ln: [100, 205], hold: 0.15, move: 0.9, ...down },
    ],
  };
}

export const squatBar = squat(
  { hN: [56.3, 24.7], hF: [56.3, 24.7], eb: [1, 1] },
  { hN: [59.7, 39.4], hF: [59.7, 39.4], eb: [1, 1] },
  [plate(behindNeck, 4.5)],
);
export const squatGoblet = squat(
  { an: [170, 20] },
  { t: 30, h: 12, an: [192, 40] },
  [weight(hands, 3.4)],
);
export const squatAir = squat({ an: [180, 180] }, { t: 44, an: [96, 94] });

export const legPress: Scene = {
  dur: 3.2,
  work: ["legN", "legF"],
  scenery: "M46.3 59L28 48.5M47 60V72M65.5 54.7L82.8 44.7M80 46.3V72",
  props: [
    {
      type: "path",
      width: 2.6,
      d: (j) => {
        const c = add(j.fN, 60, 1.8);
        return `M${pt(add(c, 150, 8))}L${pt(add(c, 330, 8))}`;
      },
    },
  ],
  frames: [
    { at: [48, 56], t: -60, h: -40, an: [150, 110], ln: [60, 60], hold: 0.3 },
    { at: [48, 56], t: -60, h: -40, an: [150, 110], ln: [20, 100], hold: 0.1 },
  ],
};

export const splitSquat: Scene = {
  dur: 3.4,
  work: ["legN"],
  scenery: "M30 58H48M33 58V72M45 58V72",
  props: [weight(hands)],
  frames: [
    { at: [68, 72], anchor: "footN", t: 3, ln: [165, 185], fF: [44, 56.5], hold: 0.3, move: 1.3 },
    { at: [68, 72], anchor: "footN", t: 10, h: 5, ln: [105, 195], fF: [44, 56.5], hold: 0.15 },
  ],
};

const standing = (x: number, y: number): Frame => ({ at: [x, y], t: 0, fN: [x, 72], fF: [x, 72] });

export const lunge: Scene = {
  dur: 4.4,
  work: ["legN", "legF"],
  frames: [
    { ...standing(58, 43.5), hold: 0.2 },
    { at: [56, 54], t: 4, fN: [70, 72], fF: [40, 72], hold: 0.2 },
    { ...standing(58, 43.5), hold: 0.2 },
    { at: [56, 54], t: 4, fN: [40, 72], fF: [70, 72], hold: 0.2 },
  ],
};

export const stepUp: Scene = {
  dur: 3.6,
  work: ["legN"],
  scenery: "M62 72V64H80V72",
  frames: [
    { at: [58, 49], t: 12, fN: [68, 64], fF: [54, 72], hold: 0.2 },
    { at: [64, 41], t: 6, fN: [68, 64], fF: [60, 60], move: 0.7 },
    { at: [68, 35.6], t: 0, fN: [68, 64], fF: [67, 64], hold: 0.35, move: 0.7 },
    { at: [64, 41], t: 6, fN: [68, 64], fF: [60, 60], move: 0.7 },
  ],
};

function hinge(down: Partial<Frame>, hand: Pt, r: number, work: Scene["work"]): Scene {
  return {
    dur: 3.6,
    work,
    props: [plate(hands, r)],
    frames: [
      { at: FOOT, anchor: "footN", t: 0, ln: [175, 185], hN: [62, 45], hF: [62, 45], hold: 0.35, move: 1.4 },
      { at: FOOT, anchor: "footN", hN: hand, hF: hand, hold: 0.15, t: 65, ...down },
    ],
  };
}

export const rdl = hinge({ t: 65, h: 55, ln: [150, 182] }, [64.5, 57], 5, ["legN", "legF"]);
export const deadlift = hinge({ t: 50, h: 35, ln: [100, 205] }, [64, 66.5], 6, ["legN", "legF", "torso"]);

export const hipThrust: Scene = {
  dur: 3.2,
  work: ["legN", "legF"],
  scenery: "M22 58H40M25 58V72M37 58V72",
  props: [plate(hands, 5.5)],
  frames: [
    { at: [57, 66], t: -61, h: -40, fN: [74, 72], fF: [74, 72], hN: [55, 61.5], hF: [55, 61.5], eb: [1, 1], hold: 0.15 },
    { at: [60, 57.1], t: -87, h: -75, fN: [74, 72], fF: [74, 72], hN: [58, 52.5], hF: [58, 52.5], eb: [1, 1], hold: 0.45 },
  ],
};

export const gluteBridge: Scene = {
  dur: 3,
  work: ["legN", "legF"],
  frames: [
    { at: [58, 68], t: -90, h: -90, fN: [72, 72], fF: [72, 72], hN: [50, 70], hF: [50, 70], eb: [1, 1], hold: 0.15 },
    { at: [55, 57], t: -121, h: -95, fN: [72, 72], fF: [72, 72], hN: [50, 70], hF: [50, 70], eb: [1, 1], hold: 0.45 },
  ],
};

const seated = (shin: number): Frame => ({ at: [48, 55], t: -8, h: 0, hN: [52, 57], hF: [52, 57], ln: [90, shin] });
const ankle = weight((j) => [j.fN[0] + 1.5, j.fN[1] - 1], 2.6);

export const legExtension: Scene = {
  dur: 3,
  work: ["legN", "legF"],
  scenery: "M44 57.5H63M42 58L39 34M52 58V72",
  props: [ankle],
  frames: [
    { ...seated(180), hold: 0.2 },
    { ...seated(82), hold: 0.45 },
  ],
};

export const legCurlSeated: Scene = {
  dur: 3,
  work: ["legN", "legF"],
  scenery: "M44 57.5H63M42 58L39 34M52 58V72M58 50.5H67",
  props: [ankle],
  frames: [
    { ...seated(75), hold: 0.2 },
    { ...seated(200), hold: 0.45 },
  ],
};

export const legCurlLying: Scene = {
  dur: 3,
  work: ["legN", "legF"],
  scenery: "M28 56H86M34 56V72M80 56V72",
  props: [weight((j) => j.fN, 2.6)],
  frames: [
    { at: [50, 53], t: 90, h: 80, ln: [-90, -90], hN: [80, 62], hF: [80, 62], hold: 0.2 },
    { at: [50, 53], t: 90, h: 80, ln: [-90, 30], hN: [80, 62], hF: [80, 62], hold: 0.45 },
  ],
};

const kneel = (lean: number, hand: Pt, extra: Partial<Frame> = {}): Frame => ({
  at: [46, 71], anchor: "footN", ln: [180 + lean, -90], t: lean, h: lean, hN: hand, hF: hand, ...extra,
});

export const nordic: Scene = {
  dur: 4.4,
  work: ["legN", "legF"],
  scenery: "M42 67.5H50",
  frames: [
    kneel(0, [64, 40], { hold: 0.3 }),
    kneel(45, [86, 58], { move: 1.6 }),
    kneel(72, [96, 71], { hold: 0.2 }),
  ],
};

const toe = (x: number, y = 66): Scene["props"] => [
  { type: "path", width: 2.8, d: (j) => `M${pt(j.fN)}L${x} ${y}` },
];

export const calfRaise: Scene = {
  dur: 2.6,
  work: ["legN", "legF"],
  scenery: "M50 72V68H76V72M78 30V72",
  props: toe(67, 68),
  frames: [
    { at: [61, 41], t: 0, fN: [61, 69.5], fF: [61, 69.5], hN: [77, 38], hF: [77, 38], hold: 0.2 },
    { at: [62, 34.5], t: 0, fN: [62, 63], fF: [62, 63], hN: [77, 38], hF: [77, 38], hold: 0.4 },
  ],
};

export const calfSeated: Scene = {
  dur: 2.6,
  work: ["legN", "legF"],
  scenery: "M40 54H58M44 54V72M58 72V66H72V72",
  props: [
    ...toe(65.5)!,
    { type: "path", width: 3, d: (j) => `M${pt([j.kN[0] - 4, j.kN[1] - 3.5])}L${pt([j.kN[0] + 5, j.kN[1] - 3.5])}` },
  ],
  frames: [
    { at: [46, 52], t: -4, fN: [60.5, 67.5], fF: [60.5, 67.5], hN: [57, 46], hF: [57, 46], hold: 0.2 },
    { at: [46, 52], t: -4, fN: [60.5, 61], fF: [60.5, 61], hN: [57, 41], hF: [57, 41], hold: 0.4 },
  ],
};
