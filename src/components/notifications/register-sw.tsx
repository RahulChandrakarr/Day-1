"use client";

import { useEffect } from "react";

// Keeps the service worker registered so push reminders can arrive.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal: the app works without notifications
      });
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
