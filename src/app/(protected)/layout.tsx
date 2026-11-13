import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AppSideBar from "@/components/layout/AppSideBar";
import Navbar from "@/components/layout/Navbar";
import { AlertsShell } from "@/components/providers/AlertsShell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createServerClient } from "@/utils/supabase/server";

// Written by SidebarProvider (src/components/ui/sidebar.tsx) whenever the
// desktop sidebar is collapsed or expanded.
const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();

  // If Supabase is configured, enforce authentication at the layout level.
  // The middleware already handles the redirect, but this is a defence-in-depth
  // check so the protected UI is never rendered without a valid session.
  let user: { email?: string; id: string; name?: string } | null = null;

  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      redirect("/login");
    }

    const fullName = authUser.user_metadata?.full_name;
    user = {
      email: authUser.email,
      id: authUser.id,
      name: typeof fullName === "string" && fullName.trim() ? fullName.trim() : undefined,
    };
  }

  // Restore the collapsed/expanded state server-side so the sidebar does not
  // jump after hydration.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        className="bg-background text-foreground ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
        href="#main-content"
      >
        Skip to content
      </a>
      {/* The verified user id comes from the server, so the client does not
          need its own auth round-trip before alerts can load. */}
      <AlertsShell userId={user?.id}>
        <AppSideBar userEmail={user?.email} userName={user?.name} />
        <div className="bg-background flex min-h-svh min-w-0 flex-1 flex-col">
          <Navbar />
          <main
            className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </AlertsShell>
    </SidebarProvider>
  );
}
