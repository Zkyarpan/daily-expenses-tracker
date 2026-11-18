"use client";

import { useState } from "react";
import { CircleNotch, Compass, Lifebuoy, ListChecks, SignOut, UserCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useHelp } from "@/components/help/HelpCenter";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import { useEngagement } from "@/components/onboarding/EngagementProvider";
import { displayNameOf, useCurrentUser } from "@/components/providers/context/CurrentUserContext";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/utils/supabase/client";

export const openSearch = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

/** Avatar button in the top bar: who is signed in, account pages and sign out. */
export function AccountMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const engagement = useEngagement();
  const { openHelp } = useHelp();
  const [signingOut, setSigningOut] = useState(false);
  if (!user?.email) return null;

  const name = displayNameOf(user);

  const go = (href: string) => {
    startRouteProgress();
    router.push(href);
  };

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient()?.auth.signOut();
      toast.success("You’ve signed out", { description: "See you soon." });
    } catch {
      toast.error("Couldn’t sign out cleanly", { description: "You’ve been taken to the sign-in page anyway." });
    } finally {
      startRouteProgress();
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className="focus-visible:ring-ring ring-offset-background rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none data-[state=open]:scale-105"
        >
          <UserAvatar name={name} seed={user.avatarSeed} size={34} className="ring-border ring-1" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-60 rounded-xl p-1.5">
        <DropdownMenuLabel className="flex items-center gap-2.5 px-2 py-2 font-normal">
          <UserAvatar name={name} seed={user.avatarSeed} size={36} />
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground truncate text-xs">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Password, data, reminders and appearance are tabs inside Profile. */}
        <DropdownMenuItem onSelect={() => go("/profile")}>
          <UserCircle aria-hidden />
          Profile &amp; settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openHelp()}>
          <Lifebuoy aria-hidden />
          Help &amp; questions
        </DropdownMenuItem>
        {engagement.enabled && (
          <>
            <DropdownMenuItem onSelect={engagement.startTour}>
              <Compass aria-hidden />
              Take the tour
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={engagement.openSetup}>
              <ListChecks aria-hidden />
              Run setup again
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          {signingOut ? <CircleNotch className="animate-spin" aria-hidden /> : <SignOut aria-hidden />}
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
