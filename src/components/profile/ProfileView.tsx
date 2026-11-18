"use client";

import { useState } from "react";
import {
  CalendarHeart,
  Database,
  LockKeyhole,
  Palette,
  Pencil,
  PiggyBank,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";

import { displayNameOf } from "@/components/providers/context/CurrentUserContext";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { avatarPalette, UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfileStats } from "@/hooks/profile/useProfile";
import { parseLocalDate } from "@/lib/dateUtils";
import type { AccountInfo } from "@/lib/profile/schemas";

import { AccountDetails } from "./AccountDetails";
import { DataSettings } from "./DataSettings";
import { PreferencesSettings } from "./PreferencesSettings";
import { EditProfileDialog, PersonalDetailsCard } from "./ProfileForm";
import { SecuritySettings } from "./SecuritySettings";
import { LocalDate } from "./SettingsCard";

const TABS = [
  { icon: UserRound, label: "Profile", value: "profile" },
  { icon: LockKeyhole, label: "Security", value: "security" },
  { icon: Palette, label: "Preferences", value: "preferences" },
  { icon: Database, label: "Data", value: "data" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const isTab = (value: string | undefined): value is TabValue => TABS.some((t) => t.value === value);

function HeroStat({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="bg-muted/40 flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3">
      <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground truncate text-xs">{label}</dt>
        <dd className="truncate text-base font-semibold tabular-nums">{children}</dd>
      </div>
    </div>
  );
}

export function ProfileView({ account, initialTab }: { account: AccountInfo; initialTab?: string }) {
  const [tab, setTab] = useState<TabValue>(isTab(initialTab) ? initialTab : "profile");
  const stats = useProfileStats();
  const [editing, setEditing] = useState(false);

  const year = new Date().getFullYear();

  // Same fallback as the sidebar: "jane.doe@x.com" → "Jane Doe".
  const displayName = displayNameOf({ email: account.email, name: account.fullName });
  const [base, mid, light] = account.avatarSeed ? avatarPalette(account.avatarSeed) : ["#064E3B", "#059669", "#34D399"];

  const changeTab = (value: string) => {
    if (!isTab(value)) return;
    setTab(value);
    window.history.replaceState(null, "", value === "profile" ? "/profile" : `/profile?tab=${value}`);
  };

  const statValue = (value: React.ReactNode, loading: boolean) =>
    loading ? <Skeleton className="mt-1 h-5 w-16" /> : value;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="text-xs font-semibold tracking-wider uppercase">Account</span>}
        title="Profile & settings"
        description="Manage your details, password, appearance and data."
      />

      {/* Profile header */}
      <section aria-label="Your profile" className="bg-card overflow-hidden rounded-2xl shadow-md">
        <div
          aria-hidden
          className="relative h-28 sm:h-36"
          style={{ background: `linear-gradient(120deg, ${mid} 0%, ${base} 60%, ${base} 100%)` }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{ backgroundImage: `radial-gradient(circle at 85% 20%, ${light} 0, transparent 45%)` }}
          />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "14px 14px",
            }}
          />
        </div>

        {/* relative: paint above the banner (itself positioned) where they overlap */}
        <div className="relative px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Change profile picture"
                className="group focus-visible:ring-ring relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <UserAvatar
                  name={displayName}
                  seed={account.avatarSeed}
                  size={96}
                  className="ring-card shadow-lg ring-4 transition-[filter] group-hover:brightness-90"
                />
                <span
                  aria-hidden
                  className="bg-card text-foreground ring-border absolute right-0.5 bottom-0.5 flex size-8 items-center justify-center rounded-full shadow-md ring-1 transition-transform group-hover:scale-110"
                >
                  <Pencil className="size-3.5" />
                </span>
              </button>
              <div className="min-w-0 pb-1">
                <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{displayName}</h2>
                <p className="text-muted-foreground truncate text-sm">{account.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:pb-1">
              <StatusBadge tone={account.emailConfirmedAt ? "success" : "warning"} dot>
                {account.emailConfirmedAt ? "Verified email" : "Email not verified"}
              </StatusBadge>
              <StatusBadge>
                Member since <LocalDate iso={account.createdAt} />
              </StatusBadge>
              <Button size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" aria-hidden />
                Edit profile
              </Button>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <HeroStat icon={ReceiptText} label="Expenses recorded">
              {statValue(stats.data?.expenses.toLocaleString("en-GB") ?? "—", stats.isPending)}
            </HeroStat>
            <HeroStat icon={Wallet} label={`Spent in ${year}`}>
              {statValue(stats.data ? <Money amount={stats.data.spentThisYear} /> : "—", stats.isPending)}
            </HeroStat>
            <HeroStat icon={CalendarHeart} label="Tracking since">
              {statValue(
                stats.data?.firstExpenseDate
                  ? parseLocalDate(stats.data.firstExpenseDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                  : "—",
                stats.isPending,
              )}
            </HeroStat>
            <HeroStat icon={PiggyBank} label="Budgets · trackers">
              {statValue(`${stats.data?.budgets ?? "—"} · ${stats.data?.trackers ?? "—"}`, stats.isPending)}
            </HeroStat>
          </dl>
        </div>
      </section>

      <Tabs value={tab} onValueChange={changeTab} className="gap-5">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {TABS.map(({ icon: Icon, label, value }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 px-3">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-3">
            <PersonalDetailsCard account={account} className="lg:col-span-2" onEdit={() => setEditing(true)} />
            <AccountDetails account={account} spentThisMonth={stats.data?.spentThisMonth ?? null} />
          </div>
        </TabsContent>
        <TabsContent value="security">
          <SecuritySettings email={account.email} />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesSettings />
        </TabsContent>
        <TabsContent value="data">
          <DataSettings storage={account.storage} />
        </TabsContent>
      </Tabs>

      <EditProfileDialog account={account} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
