"use client";

import { CalendarClock, CalendarPlus, Copy, Fingerprint, KeyRound, Mail, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import type { AccountInfo } from "@/lib/profile/schemas";

import { DetailRow, LocalDate, SettingsCard } from "./SettingsCard";

const PROVIDER_LABEL: Record<string, string> = {
  email: "Email and password",
  github: "GitHub",
  google: "Google",
};

export function AccountDetails({
  account,
  spentThisMonth,
}: {
  account: AccountInfo;
  spentThisMonth: number | null;
}) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(account.id);
      toast.success("User ID copied");
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  };

  const income = account.monthlyIncome;
  const share = income && spentThisMonth !== null ? (spentThisMonth / income) * 100 : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SettingsCard icon={ShieldCheck} title="Account" description="Details from your sign-in account.">
        <dl className="divide-y">
          <DetailRow icon={Mail} label="Email">
            <span className="block truncate">{account.email}</span>
            <StatusBadge tone={account.emailConfirmedAt ? "success" : "warning"} dot className="mt-1.5">
              {account.emailConfirmedAt ? "Verified" : "Not verified"}
            </StatusBadge>
          </DetailRow>
          <DetailRow icon={KeyRound} label="Sign-in">
            {PROVIDER_LABEL[account.provider] ?? account.provider}
          </DetailRow>
          <DetailRow icon={CalendarPlus} label="Joined">
            <LocalDate iso={account.createdAt} />
          </DetailRow>
          <DetailRow icon={CalendarClock} label="Last sign-in">
            <LocalDate iso={account.lastSignInAt} withTime />
          </DetailRow>
          <DetailRow icon={Fingerprint} label="User ID">
            <span className="inline-flex max-w-full items-center gap-1">
              <code className="text-muted-foreground truncate font-mono text-xs" title={account.id}>
                {account.id.slice(0, 8)}…{account.id.slice(-4)}
              </code>
              <Button type="button" variant="ghost" size="icon-sm" className="size-7" onClick={copyId} aria-label="Copy user ID">
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </span>
          </DetailRow>
        </dl>
      </SettingsCard>

      <SettingsCard icon={Wallet} title="This month vs income">
        {income && share !== null && spentThisMonth !== null ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <Money amount={spentThisMonth} className="text-2xl font-semibold tracking-tight" />
              <span className="text-muted-foreground text-sm tabular-nums">{share.toFixed(0)}% used</span>
            </div>
            <Meter
              label="Share of monthly income spent"
              value={spentThisMonth}
              max={income}
              valueText={`${share.toFixed(0)}% of monthly income`}
            />
            <p className="text-muted-foreground text-xs">
              of your <Money amount={income} /> monthly income
              {share < 100 ? (
                <>
                  {" "}· <Money amount={income - spentThisMonth} /> left
                </>
              ) : (
                " · over your income this month"
              )}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm leading-6">
            Add your monthly income in Personal details to see how much of it you’ve spent this month.
          </p>
        )}
      </SettingsCard>
    </div>
  );
}
