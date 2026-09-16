// Service worker for Day One: shows pushed reminders and opens the app.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Day One", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Day One";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: payload.icon || "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "day-one",
      renotify: payload.silent !== true,
      silent: payload.silent === true,
      // A pinned card stays in the shade until it is swiped away
      requireInteraction: payload.sticky === true,
      data: { url: payload.url || "/", actions: payload.actions || [] },
      actions: (payload.actions || []).map((a) => ({
        action: a.action,
        title: a.title,
      })),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const chosen = (data.actions || []).find((a) => a.action === event.action);
  // The pinned card stays put when you tap one of its buttons
  if (!chosen || chosen.action !== "keep") event.notification.close();
  const url = new URL(
    (chosen && chosen.url) || data.url || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse a window that is already open
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
