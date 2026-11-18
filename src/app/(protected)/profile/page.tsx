import { UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileView } from "@/components/profile/ProfileView";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { accountSummary, readProfile } from "@/lib/profile/server";
import { createServerClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Profile & settings · Daily Expenses" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createServerClient();

  // Demo mode: there is no account to manage.
  if (!supabase) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile & settings" description="Manage your details, password, appearance and data." />
        <EmptyState
          headingLevel="h2"
          icon={UserRound}
          title="Profiles need a signed-in account"
          description="You are using demo data. Connect Supabase and sign in to edit your profile, change your password and load sample data into your own account."
          actions={
            <Button asChild size="sm">
              <Link href="/">Back to home</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  // Same source as GET /api/profile: the profiles table, or user_metadata
  // until the migration is applied.
  const { profile, storage } = await readProfile(supabase, user);
  const account = accountSummary(user, profile, storage);

  // Keyed by tab so links like /profile?tab=data switch tabs even when the
  // profile page is already open.
  return <ProfileView key={tab ?? "profile"} account={account} initialTab={tab} />;
}
