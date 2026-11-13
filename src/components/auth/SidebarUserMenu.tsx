"use client";

import { useState } from "react";
import { CircleNotch, SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

import { startRouteProgress } from "@/components/layout/RouteProgress";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createClient } from "@/utils/supabase/client";

export function SidebarUserMenu() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      startRouteProgress();
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleLogout}
        disabled={signingOut}
        tooltip="Sign out"
        aria-label="Sign out"
        className="h-10 gap-3 rounded-xl border border-sidebar-border px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive group-data-[collapsible=icon]:border-0"
      >
        {signingOut ? (
          <CircleNotch size={17} className="shrink-0 animate-spin" />
        ) : (
          <SignOut size={17} className="shrink-0" />
        )}
        <span className="truncate">{signingOut ? "Signing out…" : "Sign out"}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
