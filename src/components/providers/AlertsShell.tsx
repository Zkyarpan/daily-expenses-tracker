/**
 * src/components/providers/AlertsShell.tsx
 *
 * Client boundary that wraps the protected pages in AlertsProvider so alert
 * state is shared across them.
 *
 * The user id is passed in from the protected layout, which has already
 * verified the session on the server (`supabase.auth.getUser()`). Previously
 * this component called getUser() again in the browser on every page load,
 * which added a network round-trip to Supabase Auth before alerts could load.
 * `userId` is undefined in demo mode (no Supabase configured).
 */

"use client";

import { AlertsProvider } from "@/components/providers/context/AlertsContext";

export function AlertsShell({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  return <AlertsProvider userId={userId}>{children}</AlertsProvider>;
}
