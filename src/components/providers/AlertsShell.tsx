/**
 * src/components/providers/AlertsShell.tsx
 *
 * Client component that:
 *  1. Reads the current authenticated user on the client side.
 *  2. Wraps children in AlertsProvider so alerts state is shared across all
 *     protected pages.
 *
 * This is a client component so it can call useCurrentUser() and pass the
 * userId to AlertsProvider.  The protected layout is a server component and
 * cannot use hooks directly.
 */

"use client";

import { AlertsProvider } from "@/components/providers/context/AlertsContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function AlertsShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  return <AlertsProvider userId={user?.id}>{children}</AlertsProvider>;
}
