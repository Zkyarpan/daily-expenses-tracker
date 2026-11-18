import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HelpProvider } from "@/components/help/HelpCenter";
import { AppFooter } from "@/components/layout/AppFooter";
import Navbar from "@/components/layout/Navbar";
import { QuickAddProvider } from "@/components/money/QuickAddProvider";
import { EngagementProvider } from "@/components/onboarding/EngagementProvider";
import { AlertsShell } from "@/components/providers/AlertsShell";
import { CurrentUserProvider } from "@/components/providers/context/CurrentUserContext";
import { ThemeSync } from "@/components/providers/ThemeSync";
import { type InterestId, needsOnboarding, readInterests } from "@/lib/onboarding/schemas";
import type { ThemePreference } from "@/lib/profile/schemas";
import { readProfile } from "@/lib/profile/server";
import { createServerClient } from "@/utils/supabase/server";

/** Signed-in pages hold personal finances: never index them. */
export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();

  // If Supabase is configured, enforce authentication at the layout level.
  // The middleware already handles the redirect, but this is a defence-in-depth
  // check so the protected UI is never rendered without a valid session.
  let user: {
    avatarSeed?: string;
    email?: string;
    id: string;
    income: number | null;
    interests: InterestId[];
    name?: string;
    needsSetup: boolean;
    theme: ThemePreference | null;
  } | null = null;

  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      redirect("/login");
    }

    // Name, avatar and theme come from the profiles table (one primary-key
    // read), or from user_metadata until the profiles migration is applied.
    const { profile } = await readProfile(supabase, authUser);
    // First-run setup state lives in user_metadata (no extra table needed).
    const onboarding = authUser.user_metadata?.onboarding;
    user = {
      avatarSeed: profile.avatarSeed ?? undefined,
      email: authUser.email,
      id: authUser.id,
      income: profile.monthlyIncome,
      interests: readInterests(onboarding),
      name: profile.fullName || undefined,
      needsSetup: needsOnboarding(onboarding),
      theme: profile.theme,
    };
  }

  return (
    <>
      <a
        className="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
        href="#main-content"
      >
        Skip to content
      </a>
      {/* The verified user comes from the server, so the client does not
          need its own auth round-trip before alerts or the account menu load. */}
      <CurrentUserProvider
        user={user ? { avatarSeed: user.avatarSeed, email: user.email, name: user.name } : null}
      >
        <AlertsShell userId={user?.id}>
          {user && <ThemeSync saved={user.theme} />}
          {/* Owns the add dialogs used by the header "+ New" menu and pages. */}
          <QuickAddProvider>
            {/* First-run questions, the app tour, daily tips/reminders,
                budget notifications and live sync while the app is open. */}
            <EngagementProvider
              enabled={Boolean(user)}
              initial={{ income: user?.income ?? null, name: user?.name ?? "" }}
              interests={user?.interests ?? []}
              needsSetup={user?.needsSetup ?? false}
            >
              {/* overflow-x-clip: nothing can make phones scroll (or zoom out) sideways;
                  unlike overflow-hidden it keeps the sticky top bar working. */}
              <HelpProvider>
              <div className="app-backdrop bg-background flex min-h-svh flex-col overflow-x-clip">
                <Navbar />
                <main
                  className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-10"
                  id="main-content"
                  tabIndex={-1}
                >
                  {children}
                </main>
                <AppFooter />
              </div>
              </HelpProvider>
            </EngagementProvider>
          </QuickAddProvider>
        </AlertsShell>
      </CurrentUserProvider>
    </>
  );
}
