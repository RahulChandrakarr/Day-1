"use client";

import { useEffect, useRef, useState } from "react";

// Tracks an element's content width so SVG charts can lay out in real pixels.
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

// Round axis ticks in whole rupees. Empty data gets a default 0–1,000 scale
// (a zero span would divide by zero and produce NaN coordinates).
export function niceTicks(max: number, min = 0, count = 4) {
  if (max === min) max = min + 1000;
  const raw = Math.max((max - min) / count, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw,
  );
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step || step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}
