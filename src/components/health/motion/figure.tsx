"use client";

import { useMemo } from "react";
import { type Joints, type Part, type Scene, n, pt, solve, timeline } from "./rig";

const PATHS: Record<Part, (j: Joints) => string> = {
  torso: (j) => `M${pt(j.pF)}L${pt(j.pN)}M${pt(j.hip)}Q${pt(j.ctrl)} ${pt(j.neck)}M${pt(j.sF)}L${pt(j.sN)}`,
  armN: (j) => `M${pt(j.sN)}L${pt(j.eN)}L${pt(j.hN)}`,
  armF: (j) => `M${pt(j.sF)}L${pt(j.eF)}L${pt(j.hF)}`,
  legN: (j) => `M${pt(j.pN)}L${pt(j.kN)}L${pt(j.fN)}`,
  legF: (j) => `M${pt(j.pF)}L${pt(j.kF)}L${pt(j.fF)}`,
};

// Far limbs sit behind the body; near limbs and weights in front
const BACK: Part[] = ["armF", "legF"];
const FRONT: Part[] = ["torso", "legN", "armN"];

export default function Figure({
  scene,
  still,
  tone,
}: {
  scene: Scene;
  still: boolean;
  tone: string;
}) {
  const { joints, keyTimes } = useMemo(() => timeline(scene), [scene]);
  const pose = useMemo(() => solve(scene.frames[scene.still ?? 0], scene.view === "front"), [scene]);
  const side = scene.view !== "front";
  const dur = `${scene.dur}s`;

  const animate = (attr: string, values: (j: Joints) => string | number) =>
    still ? null : (
      <animate
        attributeName={attr}
        values={joints.map(values).join(";")}
        keyTimes={keyTimes}
        dur={dur}
        repeatCount="indefinite"
      />
    );

  const limb = (part: Part) => (
    <path
      key={part}
      d={PATHS[part](pose)}
      className={`${scene.work?.includes(part) ? tone : ""} ${side && BACK.includes(part) ? "opacity-40" : ""}`}
    >
      {animate("d", PATHS[part])}
    </path>
  );

  const props = (scene.props ?? []).map((p, i) =>
    p.type === "path" ? (
      <path
        key={i}
        d={p.d(pose)}
        strokeWidth={p.width}
        className={p.faint ? "opacity-35" : undefined}
      >
        {animate("d", p.d)}
      </path>
    ) : (
      <circle
        key={i}
        cx={n(p.at(pose)[0])}
        cy={n(p.at(pose)[1])}
        r={p.r}
        fill="currentColor"
        fillOpacity={p.fill ? 1 : 0.18}
        strokeWidth={p.fill ? 0 : 2.2}
      >
        {animate("cx", (j) => p.at(j)[0].toFixed(1))}
        {animate("cy", (j) => p.at(j)[1].toFixed(1))}
      </circle>
    ),
  );
  const faint = props.filter((_, i) => scene.props?.[i].type === "path" && (scene.props[i] as { faint?: boolean }).faint);
  const solid = props.filter((p) => !faint.includes(p));

  return (
    <>
      {scene.ground !== false && <path d="M8 72.5H112" strokeWidth={1.4} className="opacity-25" />}
      {scene.scenery && <path d={scene.scenery} strokeWidth={2.2} className="opacity-35" />}
      {faint}
      {BACK.map(limb)}
      {FRONT.map(limb)}
      <circle cx={n(pose.head[0])} cy={n(pose.head[1])} r={4.6} fill="currentColor" stroke="none">
        {animate("cx", (j) => j.head[0].toFixed(1))}
        {animate("cy", (j) => j.head[1].toFixed(1))}
      </circle>
      {solid}
    </>
  );
}
