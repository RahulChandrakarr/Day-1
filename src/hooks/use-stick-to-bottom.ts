"use client";

import { useCallback, useEffect, useRef } from "react";

// Keeps a chat scroller pinned to the latest line while replies stream in.
// If the person scrolls up to read, it stops chasing until they send or
// scroll back down.
export function useStickToBottom(active = true) {
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLLIElement>(null);
  const stick = useRef(true);

  const pin = useCallback(() => {
    if (!active || !stick.current) return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    end.current?.scrollIntoView({ block: "end", inline: "nearest" });
  }, [active]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const follow = useCallback(() => {
    stick.current = true;
    pin();
    requestAnimationFrame(pin);
  }, [pin]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !active) return;
    const ro = new ResizeObserver(() => pin());
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [active, pin]);

  return { scroller, end, onScroll, follow, pin };
}