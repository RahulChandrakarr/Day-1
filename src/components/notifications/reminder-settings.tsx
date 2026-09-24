"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { saveReminder } from "@/app/(dashboard)/settings/actions";
import {
  PINNED,
  REMINDERS,
  timeLabel,
  type ReminderKind,
  type ReminderSetting,
} from "@/lib/reminders";

type Permission = "default" | "granted" | "denied" | "unsupported";

// Turns the base64 VAPID key into the bytes the browser wants
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function ReminderSettings({
  settings: saved,
  vapidKey,
  devices,
}: {
  settings: ReminderSetting[];
  vapidKey: string | null;
  devices: number;
}) {
  const [settings, setSettings] = useState(saved);
  const [permission, setPermission] = useState<Permission>(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window) || !("serviceWorker" in navigator))
      return "unsupported";
    return Notification.permission as Permission;
  });
  const [deviceCount, setDeviceCount] = useState(devices);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startSaving] = useTransition();

  async function enableOnThisDevice() {
    setError(null);
    setMessage(null);
    if (!vapidKey) {
      setError("Notification keys are missing on the server.");
      return;
    }
    setBusy(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as Permission);
      if (permissionResult !== "granted") {
        setError(
          "Notifications are blocked. Allow them for this site in your browser settings.",
        );
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Couldn't save this device.");
      setDeviceCount((n) => n + 1);
      // Store the times shown on screen, so the schedule exists from now on
      await Promise.all(settings.map((setting) => saveReminder(setting)));
      setMessage("This device will now get reminders.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOffHere() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
        setDeviceCount((n) => Math.max(n - 1, 0));
      }
      setMessage("Reminders are off on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/push/test", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (response.ok) setMessage("Test sent. Check your notifications.");
    else setError(body.error ?? "Couldn't send the test.");
    setBusy(false);
  }

  const pinned = settings.find((s) => s.kind === PINNED.kind);

  function update(kind: ReminderKind, patch: Partial<ReminderSetting>) {
    const next = settings.map((s) =>
      s.kind === kind ? { ...s, ...patch } : s,
    );
    setSettings(next);
    const value = next.find((s) => s.kind === kind)!;
    startSaving(async () => {
      const result = await saveReminder(value);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card border border-paper/10 bg-surface p-4">
        <h3 className="font-serif text-xl sm:text-2xl">This device</h3>
        {permission === "unsupported" ? (
          <p className="mt-2 text-sm text-paper/55">
            This browser can&apos;t show notifications. On iPhone, add Day One to
            your home screen first, then open it from there.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-paper/55">
              {deviceCount === 0
                ? "No device is set up yet."
                : `${deviceCount} device${deviceCount === 1 ? "" : "s"} set up.`}{" "}
              Reminders arrive even when the app is closed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enableOnThisDevice}
                disabled={busy}
                className="h-11 rounded-xl bg-ember px-5 text-sm font-medium text-on-ember transition-colors hover:bg-ember-light disabled:opacity-60"
              >
                {permission === "granted"
                  ? "Set up this device"
                  : "Allow notifications"}
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={busy || deviceCount === 0}
                className="h-11 rounded-xl border border-paper/15 px-4 text-sm font-medium transition hover:bg-paper/5 disabled:opacity-50"
              >
                Send a test
              </button>
              {deviceCount > 0 && (
                <button
                  type="button"
                  onClick={turnOffHere}
                  disabled={busy}
                  className="h-11 rounded-xl px-4 text-sm text-paper/50 transition hover:bg-paper/5 hover:text-paper disabled:opacity-50"
                >
                  Turn off here
                </button>
              )}
            </div>
          </>
        )}
        <AnimatePresence>
          {(message || error) && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role={error ? "alert" : "status"}
              className={`mt-3 text-sm ${
                error ? "text-red-700 dark:text-red-300" : "text-moss"
              }`}
            >
              {error ?? message}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <section className="rounded-card border border-paper/10 bg-surface p-4">
        <h3 className="font-serif text-xl sm:text-2xl">Reminders</h3>
        <p className="mt-1 text-sm text-paper/55">
          Times are Indian time. A reminder is skipped when the thing is already
          done.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {pinned && (
            <li
              className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${
                pinned.enabled
                  ? "border-paper/15 bg-ink"
                  : "border-paper/10 opacity-70"
              }`}
            >
              <span className="text-xl">{PINNED.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{PINNED.title}</span>
                <span className="block text-xs text-paper/45">{PINNED.hint}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={pinned.enabled}
                aria-label="Pinned spending card on or off"
                onClick={() =>
                  update(PINNED.kind, { enabled: !pinned.enabled })
                }
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  pinned.enabled ? "bg-moss" : "bg-paper/15"
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow ${
                    pinned.enabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </li>
          )}
          {REMINDERS.map((reminder) => {
            const setting = settings.find((s) => s.kind === reminder.kind)!;
            return (
              <li
                key={reminder.kind}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${
                  setting.enabled
                    ? "border-paper/15 bg-ink"
                    : "border-paper/10 opacity-70"
                }`}
              >
                <span className="text-xl">{reminder.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{reminder.title}</span>
                  <span className="block text-xs text-paper/45">
                    {reminder.hint}
                  </span>
                </span>
                <input
                  type="time"
                  value={timeLabel(setting.hour, setting.minute)}
                  onChange={(e) => {
                    const [hour, minute] = e.target.value.split(":").map(Number);
                    if (Number.isInteger(hour) && Number.isInteger(minute))
                      update(reminder.kind, { hour, minute });
                  }}
                  aria-label={`${reminder.title} time`}
                  className="h-10 rounded-xl border border-paper/10 bg-ink px-3 text-sm text-paper outline-none focus:border-ember/70"
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={setting.enabled}
                  aria-label={`${reminder.title} on or off`}
                  onClick={() =>
                    update(reminder.kind, { enabled: !setting.enabled })
                  }
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    setting.enabled ? "bg-moss" : "bg-paper/15"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow ${
                      setting.enabled ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
