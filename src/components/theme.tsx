"use client";

import { useSyncExternalStore } from "react";

// Light or dark. By default the app matches the device, and keeps matching it
// live (a phone that turns dark at sunset turns the app dark too). Settings ->
// Appearance can pin it to Light or Dark instead; that pick is kept on each
// device, since it's about that device's screen.

// A new key for the device-matching default: picks saved under the old ones
// are left behind, so everyone starts matching their device.
const STORAGE_KEY = "appearance";

export type ThemeChoice = "system" | "light" | "dark";

// Runs before first paint so the page never flashes the wrong theme, then
// stays listening for the device switching between light and dark.
const themeScript = `(function(){try{var k="${STORAGE_KEY}",q=window.matchMedia("(prefers-color-scheme: dark)");function a(){var t=null;try{t=localStorage.getItem(k)}catch(e){}document.documentElement.classList.toggle("dark",t==="dark"||(t!=="light"&&q.matches))}a();q.addEventListener("change",a)}catch(e){}})()`;

export function ThemeScript() {
  return (
    <script
      // Only executes from the server HTML; ignored when React renders on the client.
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}

const CHANGE_EVENT = "appearancechange";

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

// Applies a choice with the short colour transition and remembers it.
export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable (private mode); the theme still applies for this visit.
  }
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", dark);
  window.setTimeout(() => root.classList.remove("theme-transition"), 320);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The assistant can switch the theme when asked ("make it dark")
export function setTheme(theme: "light" | "dark") {
  setThemeChoice(theme);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// The saved choice; null while rendering on the server
export function useThemeChoice(): ThemeChoice | null {
  return useSyncExternalStore(subscribe, readChoice, () => null);
}
