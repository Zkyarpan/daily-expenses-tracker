"use client";

import { createContext, useContext } from "react";

export interface CurrentUser {
  /** Seed for the generative avatar (user_metadata.avatar_seed). */
  avatarSeed?: string;
  email?: string;
  name?: string;
}

/**
 * The signed-in user, verified on the server by the protected layout.
 * `null` in demo mode (no Supabase configured).
 */
const CurrentUserContext = createContext<CurrentUser | null>(null);

export function CurrentUserProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: CurrentUser | null;
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export const useCurrentUser = () => useContext(CurrentUserContext);

/** "jane.doe@x.com" → "Jane Doe" when the account has no saved name. */
const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const displayNameOf = (user: CurrentUser | null) =>
  user?.name || (user?.email ? nameFromEmail(user.email) : "");
