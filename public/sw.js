/*
 * Daily Expenses — notification service worker.
 *
 * Only shows notifications and handles taps on them. It has NO fetch handler,
 * so it never caches or intercepts pages: the app always loads fresh.
 * Needed because phones (Android Chrome, installed iPhone web apps) only show
 * notifications through a service worker.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Tapping a notification focuses an open tab (navigating it to the link) or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      const tab = tabs.find((client) => new URL(client.url).origin === self.location.origin);
      if (tab) {
        await tab.focus();
        if ("navigate" in tab && tab.url !== url) await tab.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
