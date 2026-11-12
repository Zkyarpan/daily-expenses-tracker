import { redirect } from "next/navigation";

import AppSideBar from "@/components/layout/AppSideBar";
import Navbar from "@/components/layout/Navbar";
import { AlertsShell } from "@/components/providers/AlertsShell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createServerClient } from "@/utils/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();

  // If Supabase is configured, enforce authentication at the layout level.
  // The middleware already handles the redirect, but this is a defence-in-depth
  // check so the protected UI is never rendered without a valid session.
  let userEmail: string | undefined;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userEmail = user.email;
  }

  return (
    <SidebarProvider>
      <AlertsShell>
        <AppSideBar userEmail={userEmail} />
        <main className="bg-muted/20 min-h-svh min-w-0 flex-1">
          <Navbar />
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </AlertsShell>
    </SidebarProvider>
  );
}
