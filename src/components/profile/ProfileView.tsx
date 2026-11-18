"use client";

import { useState } from "react";
import {
  Bell,
  CalendarHeart,
  ChevronRight,
  Database,
  LifeBuoy,
  LockKeyhole,
  Palette,
  Pencil,
  PiggyBank,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { displayNameOf } from "@/components/providers/context/CurrentUserContext";
import { Money } from "@/components/shared/Money";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { avatarPalette, UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileStats } from "@/hooks/profile/useProfile";
import { parseLocalDate } from "@/lib/dateUtils";
import type { AccountInfo } from "@/lib/profile/schemas";
import { cn } from "@/lib/utils";

import { AccountDetails } from "./AccountDetails";
import { DataSettings } from "./DataSettings";
import { NotificationSettings } from "./NotificationSettings";
import { PreferencesSettings } from "./PreferencesSettings";
import { EditProfileDialog, PersonalDetailsCard } from "./ProfileForm";
import { SecuritySettings } from "./SecuritySettings";
import { LocalDate } from "./SettingsCard";

const SECTIONS = [
  { description: "Name, photo, income and goals", icon: UserRound, label: "Profile", value: "profile" },
  { description: "Password and sign-in", icon: LockKeyhole, label: "Security", value: "security" },
  { description: "Theme, currency and shortcuts", icon: Palette, label: "Preferences", value: "preferences" },
  { description: "Reminders, tips and alerts", icon: Bell, label: "Notifications", value: "notifications" },
  { description: "Export, sample data, delete", icon: Database, label: "Your data", value: "data" },
] as const;

type SectionValue = (typeof SECTIONS)[number]["value"];

const isSection = (value: string | undefined): value is SectionValue => SECTIONS.some((s) => s.value === value);

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
    <div className="bg-muted/50 flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5">
      <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-muted-foreground truncate text-[11px]">{label}</dt>
        <dd className="truncate text-sm font-semibold tabular-nums">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Profile & settings, laid out like a settings app: a summary card with the
 * person and their numbers, then a section menu (a sidebar on desktop,
 * scrollable pills on phones) and the chosen section beside it.
 */
export function ProfileView({ account, initialTab }: { account: AccountInfo; initialTab?: string }) {
  const [section, setSection] = useState<SectionValue>(isSection(initialTab) ? initialTab : "profile");
  const stats = useProfileStats();
  const [editing, setEditing] = useState(false);

  const year = new Date().getFullYear();

  // Same fallback as the sidebar: "jane.doe@x.com" → "Jane Doe".
  const displayName = displayNameOf({ email: account.email, name: account.fullName });
  const [base, mid] = account.avatarSeed ? avatarPalette(account.avatarSeed) : ["#064E3B", "#059669", "#34D399"];

  const open = (value: SectionValue) => {
    setSection(value);
    window.history.replaceState(null, "", value === "profile" ? "/profile" : `/profile?tab=${value}`);
  };

  const statValue = (value: React.ReactNode, loading: boolean) =>
    loading ? <Skeleton className="mt-1 h-4 w-14" /> : value;

  const current = SECTIONS.find((s) => s.value === section)!;

  return (
    <div className="space-y-6">
      {/* ── Summary card ─────────────────────────────────────────────────── */}
      <section aria-label="Your profile" className="bg-card relative overflow-hidden rounded-3xl p-5 shadow-md sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle, ${mid}, ${base})` }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Change profile picture"
              className="group focus-visible:ring-ring relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:outline-none"
            >
              <UserAvatar
                name={displayName}
                seed={account.avatarSeed}
                size={72}
                className="ring-card shadow-md ring-4 transition-[filter] group-hover:brightness-90"
              />
              <span
                aria-hidden
                className="bg-card text-foreground ring-border absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full shadow-md ring-1"
              >
                <Pencil className="size-3" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Profile & settings</p>
              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">{displayName}</h1>
              <p className="text-muted-foreground truncate text-sm">{account.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={account.emailConfirmedAt ? "success" : "warning"} dot>
                  {account.emailConfirmedAt ? "Verified email" : "Email not verified"}
                </StatusBadge>
                <StatusBadge>
                  Member since <LocalDate iso={account.createdAt} />
                </StatusBadge>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 self-start lg:self-center" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden />
            Edit profile
          </Button>
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
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
      </section>

      {/* ── Section menu + content ───────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24">
          {/* Phones/tablets: one scrollable row of pills */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
            {SECTIONS.map(({ icon: Icon, label, value }) => {
              const active = section === value;
              return (
                <li key={value} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => open(value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Desktop: a sidebar with a line of help under each item */}
          <ul className="bg-card hidden space-y-1 rounded-2xl p-2 shadow-md lg:block">
            {SECTIONS.map(({ description, icon: Icon, label, value }) => {
              const active = section === value;
              return (
                <li key={value}>
                  <button
                    type="button"
                    onClick={() => open(value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm font-medium", active && "text-primary")}>{label}</span>
                      <span className="text-muted-foreground block truncate text-xs">{description}</span>
                    </span>
                    <ChevronRight
                      className={cn("text-muted-foreground size-4 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-60")}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
            <li className="border-t pt-1">
              <Link
                href="/help"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
              >
                <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <LifeBuoy className="size-4" aria-hidden />
                </span>
                Help &amp; support
              </Link>
            </li>
          </ul>
        </nav>

        <section aria-labelledby="section-title" className="min-w-0 space-y-4">
          <div>
            <h2 id="section-title" className="text-lg font-semibold tracking-tight">
              {current.label}
            </h2>
            <p className="text-muted-foreground text-sm">{current.description}.</p>
          </div>

          {section === "profile" && (
            <div className="grid gap-4 xl:grid-cols-3">
              <PersonalDetailsCard account={account} className="xl:col-span-2" onEdit={() => setEditing(true)} />
              <AccountDetails account={account} spentThisMonth={stats.data?.spentThisMonth ?? null} />
            </div>
          )}
          {section === "security" && <SecuritySettings email={account.email} />}
          {section === "preferences" && <PreferencesSettings />}
          {section === "notifications" && <NotificationSettings />}
          {section === "data" && <DataSettings storage={account.storage} />}
        </section>
      </div>

      <EditProfileDialog account={account} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
