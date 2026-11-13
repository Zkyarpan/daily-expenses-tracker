import { CalendarDays, Plus, ReceiptText, Search, Upload, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Meter } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard, StatCardSkeleton } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Internal component reference for the design system (docs/UI_UX_REDESIGN.md).
 * Development only and not linked from navigation. In production builds it
 * renders the standard "page not found" screen instead of any content. (The
 * HTTP status is 200 rather than 404 because the protected group's
 * loading.tsx starts streaming before notFound() runs. That is standard
 * Next.js streaming behaviour; the route also sits behind authentication.)
 * All figures are illustrative and are not read from the database.
 */

export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

const SWATCHES = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["muted", "bg-muted"],
  ["primary", "bg-primary"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["destructive", "bg-destructive"],
  ["info", "bg-info"],
  ["chart-1", "bg-chart-1"],
  ["chart-2", "bg-chart-2"],
  ["chart-3", "bg-chart-3"],
  ["chart-4", "bg-chart-4"],
  ["chart-5", "bg-chart-5"],
] as const;

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button variant="outline">
              <Upload aria-hidden />
              Secondary action
            </Button>
            <Button>
              <Plus aria-hidden />
              Primary action
            </Button>
          </>
        }
        description="Tokens and shared components used across every page. Figures on this page are illustrative only."
        eyebrow={
          <>
            <CalendarDays aria-hidden className="size-4" />
            <span>Component reference</span>
            <StatusBadge tone="info">Development only</StatusBadge>
          </>
        }
        title="Design system"
      />

      <Section
        description="Semantic colour tokens. Text pairs meet WCAG AA (4.5:1) in both themes."
        title="Colour"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SWATCHES.map(([name, className]) => (
            <div key={name} className="space-y-1.5">
              <div className={`${className} h-12 rounded-lg border`} />
              <p className="font-mono text-xs">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section description="System font stack; tabular figures for money." title="Typography">
          <div className="space-y-3">
            <p className="text-[1.75rem] leading-9 font-semibold tracking-tight">Page title</p>
            <p className="text-lg font-semibold tracking-tight">Section title</p>
            <p className="text-sm leading-6">
              Body text for descriptions, help and table cells.
            </p>
            <p className="text-muted-foreground text-sm">Secondary text and captions.</p>
            <p className="text-2xl font-semibold tracking-tight">
              <Money amount={1234.5} />
            </p>
          </div>
        </Section>

        <Section description="Status is always a colour plus a word." title="Status">
          <div className="flex flex-wrap gap-2">
            <StatusBadge dot tone="success">On track</StatusBadge>
            <StatusBadge dot tone="warning">80% used</StatusBadge>
            <StatusBadge dot tone="critical">Over budget</StatusBadge>
            <StatusBadge tone="info">Info</StatusBadge>
            <StatusBadge tone="brand">New</StatusBadge>
            <StatusBadge>Neutral</StatusBadge>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Money amount={42.5} signed tone="positive" />
            <Money amount={-18.2} tone="negative" />
            <Money amount={13490.77} compact />
            <Money amount={0} tone="muted" />
          </div>
        </Section>
      </div>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button aria-label="Search" size="icon" variant="outline">
            <Search aria-hidden />
          </Button>
        </div>
      </Section>

      <Section description="Visible labels, helper text and inline errors." title="Form fields">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ds-description">Description</Label>
            <Input id="ds-description" placeholder="e.g. Weekly groceries" />
            <p className="text-muted-foreground text-xs">Shown in your transaction list.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ds-amount">Amount</Label>
            <Input
              aria-describedby="ds-amount-error"
              aria-invalid
              defaultValue="-0"
              id="ds-amount"
              inputMode="decimal"
            />
            <p className="text-destructive text-xs" id="ds-amount-error">
              Enter an amount other than zero.
            </p>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          delta={{ goodDirection: "down", label: "vs last month", value: -8.4 }}
          icon={Wallet}
          label="Spent this month"
          value={<Money amount={1124.23} />}
        />
        <StatCard
          delta={{ goodDirection: "down", label: "vs last month", value: 12.6 }}
          icon={ReceiptText}
          label="Transactions"
          value="83"
        />
        <StatCard hint="of £1,500 budgeted" label="Budget used" value="86%">
          <Meter className="mt-1" label="Budget used" value={86} />
        </StatCard>
        <StatCardSkeleton />
      </div>

      <Section
        description="Colour follows the 80% warning and 100% critical alert thresholds."
        title="Meters"
      >
        <div className="space-y-4">
          {[45, 85, 100, 130].map((value) => (
            <div key={value} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
              <span className="text-muted-foreground text-sm tabular-nums">{value}%</span>
              <Meter label={`Example meter at ${value}%`} value={value} />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <EmptyState
          actions={
            <>
              <Button>
                <Plus aria-hidden />
                Add expense
              </Button>
              <Button variant="outline">
                <Upload aria-hidden />
                Import CSV
              </Button>
            </>
          }
          description="Add your first expense or import a bank statement to see it here."
          icon={ReceiptText}
          title="No expenses this month"
        />
        <div className="space-y-4">
          <ErrorState
            message="The server could not be reached. Check your connection and try again."
            title="Couldn’t load your budgets"
          />
          <Card className="gap-3 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </Card>
        </div>
      </div>
    </div>
  );
}
