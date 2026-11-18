"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import { profileApi } from "@/lib/api/profile";
import { type ThemePreference,THEMES } from "@/lib/profile/schemas";

/**
 * Keeps the colour theme in step with the account, so it follows the user
 * across devices:
 *  - on first load, a theme saved on the account wins over this device's;
 *    if the account has none yet, this device's choice is saved to it;
 *  - afterwards, any change (navbar toggle, ⌘K, Preferences) is saved via
 *    PATCH /api/profile, debounced.
 * Renders nothing. Mounted by the protected layout for signed-in users only.
 */
export function ThemeSync({ saved }: { saved: ThemePreference | null }) {
  const { setTheme, theme } = useTheme();
  const initialised = useRef(false);
  const lastSaved = useRef<string | null>(saved);

  useEffect(() => {
    // next-themes reports undefined until it has read localStorage.
    if (!theme || !THEMES.includes(theme as ThemePreference)) return;

    if (!initialised.current) {
      initialised.current = true;
      if (saved && theme !== saved) {
        setTheme(saved);
        return;
      }
    }
    if (theme === lastSaved.current) return;

    const timer = setTimeout(() => {
      lastSaved.current = theme;
      // Best effort: the local theme already applied; retry on the next change.
      profileApi.update({ theme: theme as ThemePreference }).catch(() => {
        lastSaved.current = null;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [saved, setTheme, theme]);

  return null;
}
