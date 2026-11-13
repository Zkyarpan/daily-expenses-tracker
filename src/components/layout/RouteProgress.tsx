"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin progress bar at the top of the window during page navigation.
 *
 * The App Router has no "navigation started" event, so the bar starts when
 * the user clicks an internal link (or when code calls `startRouteProgress()`
 * before `router.push`) and finishes when the URL actually changes.
 * No dependencies; colours come from the theme (`--foreground`).
 */

const START_EVENT = "route-progress:start";

/** Call right before a programmatic `router.push()` to show the bar. */
export function startRouteProgress() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(START_EVENT));
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Same page (or only the #hash changes): nothing to load.
  return !(url.pathname === window.location.pathname && url.search === window.location.search);
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  const clearTimers = () => {
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    trickle.current = null;
    safety.current = null;
  };

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    // Let the bar reach the end, then fade and reset.
    setTimeout(() => setVisible(false), 200);
    setTimeout(() => setProgress(0), 450);
  }, []);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    clearTimers();
    setVisible(true);
    setProgress(12);
    // Ease towards 90 % while waiting; the last 10 % happens on arrival.
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p));
    }, 180);
    // Never leave the bar stuck if a navigation is cancelled.
    safety.current = setTimeout(finish, 15000);
  }, [finish]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      clearTimers();
    };
  }, [start]);

  // The URL changed: the new page has been committed.
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms ease" }}
    >
      <div
        className="bg-foreground h-full rounded-r-full shadow-[0_0_10px_var(--foreground)]"
        style={{
          transition: progress === 0 ? "none" : "width 200ms ease-out",
          width: `${progress}%`,
        }}
      />
    </div>
  );
}

export function RouteProgress() {
  // useSearchParams needs a Suspense boundary so static pages still prerender.
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
