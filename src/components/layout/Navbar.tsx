"use client";

import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";

import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { Button } from "@/components/ui/button";

import { SidebarTrigger } from "../ui/sidebar";

import { CommandPalette } from "./CommandPalette";
import { ModeToggle } from "./ThemeButton";

function AlertsBell() {
  const { alerts, unreadCount, markAsRead, markAllAsRead, dismiss, dismissAll } = useAlerts();

  return (
    <AlertsPanel
      alerts={alerts}
      unreadCount={unreadCount}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDismiss={dismiss}
      onDismissAll={dismissAll}
    />
  );
}

function usePageTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments
      .at(-1)
      ?.split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") || "Workspace"
  );
}

const Navbar = () => {
  const pathname = usePathname();
  const pageTitle = usePageTitle(pathname);

  return (
    <header
      aria-label="Application header"
      className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border/50 bg-background/95 px-4 backdrop-blur-md sm:px-6"
    >
      {/* Left: sidebar trigger + page title */}
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted -ml-1 size-9 rounded-xl transition-colors" />
        <div className="h-5 w-px bg-border" />
        <h1 className="truncate text-base font-bold tracking-tight text-foreground leading-none" style={{ letterSpacing: "-0.025em" }}>
          {pageTitle}
        </h1>
      </div>

      {/* Hidden command palette (triggered via keyboard) */}
      <CommandPalette />

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Search button */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true }),
            )
          }
          aria-label="Open search (⌘K)"
        >
          <MagnifyingGlass size={14} weight="bold" className="shrink-0" />
          <span className="hidden sm:inline font-medium">Search</span>
          <kbd className="hidden rounded-lg bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none sm:inline">
            ⌘K
          </kbd>
        </Button>

        {/* Alerts bell */}
        <AlertsBell />

        {/* Theme toggle */}
        <ModeToggle />
      </div>
    </header>
  );
};

export default Navbar;
