import { type Frame, type Scene } from "./rig";

// Stretches ease a little deeper and back, slowly
const hold = (a: Frame, b: Frame, work: Scene["work"], extra: Partial<Scene> = {}): Scene => ({
  dur: 3.6,
  work,
  frames: [
    { ...a, hold: 0.8 },
    { ...b, hold: 0.8 },
  ],
  ...extra,
});

export const quadStretch = hold(
  { at: [62, 43.5], t: 0, ln: [180, -10], fF: [62, 72], hN: [59.6, 45], hF: [83, 30] },
  { at: [62, 43.5], t: 3, ln: [190, -20], fF: [62, 72], hN: [55, 45.4], hF: [83, 30] },
  ["legN"],
  { scenery: "M85 16V72" },
);

const sit = (t: number, hand: [number, number]): Frame => ({
  at: [40, 70], t, h: t - 5, spine: t > 40 ? -3 : 0, ln: [90, 90], lf: [70, 250], hN: hand, hF: hand,
});
export const hamstringStretch = hold(sit(35, [58, 63]), sit(65, [69, 66]), ["legN"]);

const doorway = (x: number, t: number): Frame => ({
  at: [x, 43.5], t, fN: [x + 5, 72], fF: [x - 6, 72], hN: [61, 12], eb: [1, 1],
});
export const doorwayChest = hold(doorway(70, 0), doorway(71.5, 10), ["torso"], { scenery: "M61 6V72" });

const child = (th: number, t: number): Frame => ({
  at: [40, 71], anchor: "footN", ln: [th, -90], t, h: 110, spine: -3, hN: [94, 70], hF: [94, 70],
});
export const childsPose = hold(child(129, 100), child(137, 97), ["torso"]);

const across = (hand: [number, number], hold: [number, number]): Frame => ({
  at: [60, 43.5], t: 0, fN: [63, 72], fF: [57, 72], hN: hand, hF: hold, eb: [1, -1],
});
export const crossBody = hold(across([48, 26], [60, 32]), across([45, 27], [61, 33]), ["armN"], { view: "front" });

const lyingBack = (thigh: number, shin: number, foot: [number, number]): Frame => ({
  at: [62, 68], t: -90, h: -90, ln: [thigh, shin], fF: foot, hN: [58, 58], hF: [58, 58],
});
export const figureFour = hold(lyingBack(-10, 90, [59.5, 53.7]), lyingBack(-30, 80, [54.8, 55.4]), ["legF"]);

const overhead = (an: [number, number]): Frame => ({
  at: [60, 43.5], t: 0, fN: [63, 72], fF: [57, 72], an, af: [185, 185],
});
export const tricepsStretch = hold(overhead([8, 210]), overhead([0, 218]), ["armN"], { view: "front" });

const prone = (t: number, h: number, spine: number): Frame => ({
  at: [44, 69], t, h, spine, ln: [-90, -90], hN: [64, 71], hF: [64, 71],
});
export const cobra = hold(prone(80, 80, 0), prone(45, 20, 3), ["torso"]);

const lean = (x: number, t: number, foot: number): Frame => ({
  at: [x, 47], t, fN: [foot, 72], fF: [72, 72], hN: [87, 26], hF: [87, 26],
});
export const calfWall = hold(lean(62, 25, 48), lean(64, 30, 49.5), ["legN"], { scenery: "M89 6V72" });

const reachBack = (x: number, t: number): Frame => ({
  at: [x, 43.5], t, fN: [x, 72], fF: [x, 72], hN: [37, 23],
});
export const bicepsWall = hold(reachBack(57, 0), reachBack(59, 4), ["armN"], { scenery: "M35 6V72" });

const rack = (ln: number, spine: number, h: number): Frame => ({
  at: [40, 72], anchor: "footN", ln: [ln, 185], t: 88, h, spine, hN: [77.5, 44], hF: [77.5, 44],
});
export const latStretch = hold(rack(155, 0, 88), rack(148, 4, 120), ["torso"], { scenery: "M80 38V72M76 44H84" });
