// A stick-figure rig. A pose is a set of limb angles (degrees, 0 = up,
// 90 = forward, 180 = down), or a target point a hand/foot should reach.
// Frames are blended by angle, so limbs keep their length while moving.

export type Pt = [number, number];
export type Part = "torso" | "armN" | "armF" | "legN" | "legF";
type Pair = [number, number];

export type Frame = {
  at: Pt;
  anchor?: "hip" | "footN" | "handN";
  t: number; // torso, hip to neck
  h?: number; // head, defaults to the torso angle
  an?: Pair; // near arm: upper, fore
  af?: Pair; // far arm
  ln?: Pair; // near leg: thigh, shin
  lf?: Pair; // far leg
  hN?: Pt; // hand / foot targets (override the angles)
  hF?: Pt;
  fN?: Pt;
  fF?: Pt;
  eb?: Pair; // which side the elbows bend to (near, far)
  kb?: Pair; // which side the knees bend to
  spine?: number; // back curve; negative rounds it
  tl?: number; // torso length, shorter when it leans toward the viewer
  al?: number; // arm length as seen, shorter when arms point at the viewer
  hold?: number; // time spent still on this frame
  move?: number; // time to reach the next frame
  k?: number; // free value for props
};

export type Joints = {
  hip: Pt; neck: Pt; head: Pt; ctrl: Pt;
  sN: Pt; sF: Pt; pN: Pt; pF: Pt;
  eN: Pt; hN: Pt; eF: Pt; hF: Pt;
  kN: Pt; fN: Pt; kF: Pt; fF: Pt;
  k: number;
};

export type Prop =
  | { type: "path"; d: (j: Joints) => string; faint?: boolean; width?: number }
  | { type: "dot"; at: (j: Joints) => Pt; r: number; fill?: boolean };

export type Scene = {
  view?: "side" | "front";
  dur: number;
  frames: Frame[];
  work?: Part[];
  props?: Prop[];
  scenery?: string;
  still?: number;
  ground?: boolean;
  linear?: boolean; // steady speed, for pedalling and ropes
};

const LEN = { torso: 21, neck: 7.5, upper: 11, fore: 10.5, thigh: 14.5, shin: 14 };
const SHOULDER = 5.5;
const HIP = 3;

const rad = (a: number) => (a * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const add = (p: Pt, a: number, len: number): Pt => [
  p[0] + Math.sin(rad(a)) * len,
  p[1] - Math.cos(rad(a)) * len,
];
const m = (a: number, b: number, t: number) => a + (b - a) * t;
const lp = (a: Pt, b: Pt, t: number): Pt => [m(a[0], b[0], t), m(a[1], b[1], t)];
const mp = (a: Pair, b: Pair, t: number): Pair => [m(a[0], b[0], t), m(a[1], b[1], t)];
const mid = (a: Pt, b: Pt): Pt => lp(a, b, 0.5);

export const n = (v: number) => Math.round(v * 10) / 10;
export const pt = (p: Pt) => `${n(p[0])} ${n(p[1])}`;

function limb(root: Pt, angles: Pair, a: number, b: number, target: Pt | undefined, bend: number): [Pt, Pt] {
  if (!target) {
    const joint = add(root, angles[0], a);
    return [joint, add(joint, angles[1], b)];
  }
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(a - b) + 0.01), a + b - 0.01);
  const base = deg(Math.atan2(dx, -dy));
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = deg(Math.acos(Math.min(1, Math.max(-1, cos))));
  return [add(root, base - bend * alpha, a), add(root, base, d)];
}

export function solve(f: Frame, front: boolean): Joints {
  const so = front ? SHOULDER : 0;
  const ho = front ? HIP : 0;
  const an = f.an ?? [180, 180];
  const af = f.af ?? an;
  const ln = f.ln ?? [180, 180];
  const lf = f.lf ?? ln;
  const [ebN, ebF] = f.eb ?? [-1, -1];
  const [kbN, kbF] = f.kb ?? [1, 1];

  const torso = f.tl ?? LEN.torso;
  const upper = LEN.upper * (f.al ?? 1);
  const fore = LEN.fore * (f.al ?? 1);
  let hip = f.at;
  if (f.anchor === "footN") {
    const knee = add(f.at, ln[1], -LEN.shin);
    hip = add(add(knee, ln[0], -LEN.thigh), f.t + 90, -ho);
  } else if (f.anchor === "handN") {
    const elbow = add(f.at, an[1], -fore);
    const shoulder = add(elbow, an[0], -upper);
    hip = add(add(shoulder, f.t + 90, -so), f.t, -torso);
  }

  const neck = add(hip, f.t, torso);
  const sN = add(neck, f.t + 90, so);
  const sF = add(neck, f.t + 90, -so);
  const pN = add(hip, f.t + 90, ho);
  const pF = add(hip, f.t + 90, -ho);
  const [eN, hN] = limb(sN, an, upper, fore, f.hN, ebN);
  const [eF, hF] = limb(sF, af, upper, fore, f.hF, ebF);
  const [kN, fN] = limb(pN, ln, LEN.thigh, LEN.shin, f.fN, kbN);
  const [kF, fF] = limb(pF, lf, LEN.thigh, LEN.shin, f.fF, kbF);
  return {
    hip, neck, sN, sF, pN, pF, eN, hN, eF, hF, kN, fN, kF, fF,
    head: add(neck, f.h ?? f.t, LEN.neck),
    ctrl: add(mid(hip, neck), f.t + 90, f.spine ?? 0),
    k: f.k ?? 0,
  };
}

const TARGETS = ["hN", "hF", "fN", "fF"] as const;

function mix(a: Frame, b: Frame, t: number, front: boolean): Frame {
  const ja = solve(a, front);
  const jb = solve(b, front);
  const same = (a.anchor ?? "hip") === (b.anchor ?? "hip");
  const out: Frame = {
    at: same ? lp(a.at, b.at, t) : lp(ja.hip, jb.hip, t),
    anchor: same ? a.anchor : "hip",
    t: m(a.t, b.t, t),
    h: m(a.h ?? a.t, b.h ?? b.t, t),
    an: mp(a.an ?? [180, 180], b.an ?? [180, 180], t),
    af: mp(a.af ?? a.an ?? [180, 180], b.af ?? b.an ?? [180, 180], t),
    ln: mp(a.ln ?? [180, 180], b.ln ?? [180, 180], t),
    lf: mp(a.lf ?? a.ln ?? [180, 180], b.lf ?? b.ln ?? [180, 180], t),
    eb: a.eb ?? b.eb,
    kb: a.kb ?? b.kb,
    spine: m(a.spine ?? 0, b.spine ?? 0, t),
    tl: m(a.tl ?? LEN.torso, b.tl ?? LEN.torso, t),
    al: m(a.al ?? 1, b.al ?? 1, t),
    k: m(a.k ?? 0, b.k ?? 0, t),
  };
  for (const key of TARGETS) {
    if (a[key] || b[key]) out[key] = lp(a[key] ?? ja[key], b[key] ?? jb[key], t);
  }
  return out;
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const STEPS = 12;

// Every sampled pose over one loop, with the matching SMIL keyTimes
export function timeline(scene: Scene) {
  const front = scene.view === "front";
  const frames = scene.frames;
  const curve = scene.linear ? (t: number) => t : ease;
  const points: { f: Frame; time: number }[] = [];
  let time = 0;
  frames.forEach((a, i) => {
    const b = frames[(i + 1) % frames.length];
    points.push({ f: a, time });
    if (a.hold) {
      time += a.hold;
      points.push({ f: a, time });
    }
    const move = a.move ?? 1;
    for (let s = 1; s < STEPS; s++) {
      points.push({ f: mix(a, b, curve(s / STEPS), front), time: time + (move * s) / STEPS });
    }
    time += move;
  });
  points.push({ f: frames[0], time });
  return {
    joints: points.map((p) => solve(p.f, front)),
    keyTimes: points.map((p) => (p.time / time).toFixed(4)).join(";"),
  };
}

// Shared props
export const plate = (at: (j: Joints) => Pt, r = 5): Prop => ({ type: "dot", at, r });
export const weight = (at: (j: Joints) => Pt, r = 2.8): Prop => ({ type: "dot", at, r, fill: true });
export const cable = (from: Pt, to: (j: Joints) => Pt): Prop => ({
  type: "path",
  faint: true,
  width: 1.4,
  d: (j) => `M${pt(from)}L${pt(to(j))}`,
});
export const handMid = (j: Joints) => mid(j.hN, j.hF);

// Where a barbell sits on the upper back
export const behindNeck = (j: Joints): Pt => {
  const len = Math.hypot(j.neck[0] - j.hip[0], j.neck[1] - j.hip[1]);
  const vx = (j.neck[0] - j.hip[0]) / len;
  const vy = (j.neck[1] - j.hip[1]) / len;
  return [j.neck[0] - vx * 2.5 + vy * 5, j.neck[1] - vy * 2.5 - vx * 5];
};

// A barbell seen from the front, held in both hands
export const barFront: Prop = {
  type: "path",
  d: (j) => {
    const [l, r] = j.hF[0] < j.hN[0] ? [j.hF, j.hN] : [j.hN, j.hF];
    return `M${n(l[0] - 9)} ${n(l[1])}L${n(r[0] + 9)} ${n(r[1])}M${n(l[0] - 6)} ${n(l[1] - 4.5)}L${n(l[0] - 6)} ${n(l[1] + 4.5)}M${n(r[0] + 6)} ${n(r[1] - 4.5)}L${n(r[0] + 6)} ${n(r[1] + 4.5)}`;
  },
};
