"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { BAR_ICON_BUTTON } from "./styles";

/**
 * One-click light/dark switch for the top bar. "System" is still available
 * from ⌘K and Profile → Preferences.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(BAR_ICON_BUTTON, className)}
      aria-label="Switch between light and dark theme"
      title="Light / dark"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Both icons render; CSS shows the right one, so server and client markup match. */}
      <Sun size={18} weight="bold" className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" aria-hidden />
      <Moon size={18} weight="bold" className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" aria-hidden />
    </Button>
  );
}

/** The same switch as a full-width row, for the phone menu. */
export function ThemeMenuRow() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
    >
      {/* CSS picks the icon and label, so server and client markup match. */}
      <Sun size={18} className="hidden dark:block" aria-hidden />
      <Moon size={18} className="dark:hidden" aria-hidden />
      <span className="hidden dark:inline">Light theme</span>
      <span className="dark:hidden">Dark theme</span>
    </button>
  );
}
