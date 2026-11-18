/**
 * src/lib/notify.ts — system notifications (the ones outside the browser tab).
 *
 * Uses the notification service worker (public/sw.js) when it is available —
 * required on Android Chrome and installed iPhone web apps — and falls back to
 * `new Notification()` on desktop. Browser-only; every function is a safe
 * no-op on the server or when notifications aren't supported/allowed.
 */

export type NotifyPermission = NotificationPermission | "unsupported";

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export const notificationPermission = (): NotifyPermission =>
  notificationsSupported() ? Notification.permission : "unsupported";

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers /sw.js once per page load. Resolves to null when unavailable. */
export function registerNotificationWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) {
    return Promise.resolve(null);
  }
  registration ??= navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
  return registration;
}

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T) =>
  Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/**
 * Shows a system notification. Returns false when it couldn't be shown
 * (not allowed, unsupported, or the browser refused) so the caller can fall
 * back to an in-app pop-up.
 */
export async function showSystemNotification(
  title: string,
  options: { body: string; tag?: string; url?: string },
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const payload: NotificationOptions = {
    badge: "/icon.svg",
    body: options.body,
    data: { url: options.url ?? "/" },
    icon: "/icon.svg",
    tag: options.tag ?? title,
  };

  // Preferred: through the service worker (works on phones too).
  const sw = await withTimeout(registerNotificationWorker(), 3_000, null);
  if (sw) {
    try {
      await sw.showNotification(title, payload);
      return true;
    } catch {
      // Fall through to the page-level API.
    }
  }

  try {
    const notification = new Notification(title, payload);
    notification.onclick = () => {
      window.focus();
      if (options.url) window.location.assign(options.url);
      notification.close();
    };
    return true;
  } catch {
    // e.g. Android Chrome without a service worker.
    return false;
  }
}

/** Asks for permission (must be called from a click). */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    void registerNotificationWorker();
    return result;
  } catch {
    return Notification.permission;
  }
}
