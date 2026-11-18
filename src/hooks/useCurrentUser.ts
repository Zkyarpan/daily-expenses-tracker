/**
 * src/hooks/useCurrentUser.ts
 *
 * Lightweight hook to get the currently authenticated Supabase user.
 * Returns null when in demo mode (no Supabase configured).
 */

"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export function useCurrentUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;

    // Get the current session immediately
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    // Keep in sync with auth state changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return user;
}
