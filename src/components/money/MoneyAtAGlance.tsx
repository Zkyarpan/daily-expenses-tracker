"use client";

import { ArrowDownLeft, ArrowUpRight, ChevronRight, Gift, PiggyBank } from "lucide-react";
import Link from "next/link";

import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMoneyOverview } from "@/hooks/money/useMoney";
import type { MonthSavings } from "@/lib/money/schemas";
import { cn } from "@/lib/utils";

import { SetupRequiredCard } from "./SetupRequiredCard";

const STATUS: Record<NonNullable<MonthSavings["status"]>, { label: string; tone: StatusTone }> = {
  "at-risk": { label: "At risk", tone: "warning" },
  "off-track": { label: "Behind goal", tone: "critical" },
  "on-track": { label: "On track", tone: "success" },
};

function Tile({
  children,
  className,
  href,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  icon: typeof PiggyBank;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group bg-card focus-visible:ring-ring flex min-w-0 flex-col gap-2.5 rounded-2xl p-4 shadow-md transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:outline-none sm:p-5",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
      </span>
      {children}
      <ChevronRight
        className="text-muted-foreground mt-auto ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

const Value = ({ children }: { children: React.ReactNode }) => (
  <span className="truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{children}</span>
);
const Hint = ({ children }: { children: React.ReactNode }) => (
  <span className="text-muted-foreground text-xs leading-5">{children}</span>
);

function SavingsTile({ savings }: { savings: MonthSavings }) {
  if (savings.income === null) {
    return (
      <Tile href="/plan" icon={PiggyBank} label="Saved this month">
        <Value>—</Value>
        <Hint>Add your salary in Savings plan to see what you’re saving and what’s safe to spend.</Hint>
      </Tile>
    );
  }

  const saved = savings.savedSoFar ?? 0;
  const status = savings.status ? STATUS[savings.status] : null;
  return (
    <Tile href="/plan" icon={PiggyBank} label="Saved this month">
      <span className="flex flex-wrap items-center gap-2">
        <Value>
          <Money amount={saved} tone={saved < 0 ? "negative" : "default"} />
        </Value>
        {status && (
          <StatusBadge tone={status.tone} dot className="py-0 text-[11px]">
            {status.label}
          </StatusBadge>
        )}
      </span>
      {savings.goal !== null && (
        <Meter
          size="sm"
          tone={status?.tone === "success" ? "success" : status?.tone === "warning" ? "warning" : "critical"}
          label="Savings goal progress"
          value={Math.max(0, saved)}
          max={savings.goal}
        />
      )}
      <Hint>
        {savings.safeToSpend !== null && (
          <>
            Safe to spend <Money amount={savings.safeToSpend} className="text-foreground font-medium" />
            {savings.daysLeft > 1 && savings.safeToSpendPerDay !== null && (
              <> · <Money amount={savings.safeToSpendPerDay} />/day</>
            )}
          </>
        )}
        {savings.goal === null && " · set a savings goal in Savings plan"}
        {savings.goal !== null && (
          <>
            {" "}· goal <Money amount={savings.goal} />
          </>
        )}
      </Hint>
    </Tile>
  );
}

export function MoneyAtAGlance() {
  const { data, isError, isPending } = useMoneyOverview();

  if (isError) return null;
  if (isPending || !data) {
    return (
      <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[136px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const { ious, savings, wishlist } = data;
  const next = wishlist?.nextUp ?? null;

  return (
    <section aria-label="Your money at a glance" data-tour="glance" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <SavingsTile savings={savings} />

      {data.setupRequired || !ious || !wishlist ? (
        <SetupRequiredCard compact className="sm:col-span-1 xl:col-span-3" />
      ) : (
        <>
          <Tile href="/lend-borrow" icon={ArrowUpRight} label="They owe you">
            <Value>
              <Money amount={ious.owedToMe} tone={ious.owedToMe > 0 ? "positive" : "default"} />
            </Value>
            <Hint>
              {ious.owedToMe > 0
                ? `From ${ious.people.filter((p) => p.balance > 0).length} ${ious.people.filter((p) => p.balance > 0).length === 1 ? "person" : "people"}`
                : "Nobody owes you anything"}
            </Hint>
          </Tile>
          <Tile href="/lend-borrow" icon={ArrowDownLeft} label="You owe">
            <Value>
              <Money amount={ious.iOwe} />
            </Value>
            <Hint>
              {ious.overdueCount > 0 ? (
                <span className="text-destructive font-medium">{ious.overdueCount} overdue</span>
              ) : ious.iOwe > 0 ? (
                `To ${ious.people.filter((p) => p.balance < 0).length} ${ious.people.filter((p) => p.balance < 0).length === 1 ? "person" : "people"}`
              ) : (
                "You’re all square"
              )}
            </Hint>
          </Tile>
          <Tile href="/wishlist" icon={Gift} label="Wishlist">
            <Value>
              <Money amount={wishlist.remaining} />
            </Value>
            {next ? (
              <>
                <Meter size="sm" tone="brand" label={`Saved for ${next.name}`} value={next.savedAmount} max={next.price} />
                <Hint>
                  Next: <span className="text-foreground font-medium">{next.name}</span> ·{" "}
                  <Money amount={next.savedAmount} /> of <Money amount={next.price} />
                </Hint>
              </>
            ) : (
              <Hint>{wishlist.openCount === 0 ? "Add things you want to buy" : "to go"}</Hint>
            )}
          </Tile>
        </>
      )}
    </section>
  );
}
