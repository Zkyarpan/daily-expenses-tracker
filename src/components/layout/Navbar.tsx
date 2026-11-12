"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/components/providers/context/AlertsContext";

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

const Navbar = () => {
  const pathname = usePathname();

  const pageTitle =
    pathname === "/"
      ? "Dashboard"
      : pathname
          .split("/")
          .filter(Boolean)
          .at(-1)
          ?.replaceAll("-", " ")
          .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Workspace";

  return (
    <header
      aria-label="Application header"
      className="bg-background/90 sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b px-4 backdrop-blur sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger />
        <div className="bg-border h-5 w-px" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{pageTitle}</p>
          <p className="text-muted-foreground hidden text-xs sm:block">
            Daily Expenses Tracker
          </p>
        </div>
      </div>

      <CommandPalette />

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground size-8 gap-2 p-0 text-xs sm:h-9 sm:w-auto sm:px-3"
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true }),
            )
          }
          aria-label="Search navigation"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="bg-muted hidden rounded px-1 py-0.5 font-mono text-xs sm:inline">
            ⌘K
          </kbd>
        </Button>
        <AlertsBell />
        <ModeToggle />
      </div>
    </header>
  );
};

export default Navbar;
