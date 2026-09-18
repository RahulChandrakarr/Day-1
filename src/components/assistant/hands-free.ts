"use client";

import { useSyncExternalStore } from "react";

// Per device on purpose: it keeps this device's microphone on.
const KEY = "day-one:hands-free";
const EVENT = "day-one:hands-free";

export const handsFree = {
  subscribe(callback: () => void) {
    window.addEventListener(EVENT, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(EVENT, callback);
      window.removeEventListener("storage", callback);
    };
  },
  get() {
    try {
      return localStorage.getItem(KEY) === "on";
    } catch {
      return false;
    }
  },
  set(on: boolean) {
    try {
      if (on) localStorage.setItem(KEY, "on");
      else localStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  },
};

export function useHandsFree() {
  return useSyncExternalStore(handsFree.subscribe, handsFree.get, () => false);
}
