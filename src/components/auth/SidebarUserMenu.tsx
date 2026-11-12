"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { createClient } from "@/utils/supabase/client";

export function SidebarUserMenu() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleLogout}
        tooltip="Sign out"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Sign out"
      >
        <LogOut className="size-4" />
        <span className="truncate">Sign out</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
