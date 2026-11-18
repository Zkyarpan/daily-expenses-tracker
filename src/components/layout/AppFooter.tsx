"use client";

import { ArrowUp, Lock, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

import { ACCOUNT_GROUP, NAV_GROUPS } from "./navigation";

const SHELL_WIDTH = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";

const money = NAV_GROUPS.find((g) => g.label === "Money")?.items ?? [];
const insights = [
  ...(NAV_GROUPS.find((g) => g.label === "Insights")?.items ?? []),
  ...(NAV_GROUPS.find((g) => g.label === "AI")?.items ?? []),
];
const account = [
  ACCOUNT_GROUP.items[0],
  { title: "Password & security", url: "/profile?tab=security" },
  { title: "Export your data", url: "/profile?tab=data" },
  { title: "Appearance", url: "/profile?tab=preferences" },
];

const COLUMNS = [
  { links: money, title: "Money" },
  { links: insights, title: "Plan & insights" },
  { links: account, title: "Account" },
];

/**
 * Site footer for every signed-in page. A client component because it reads
 * the shared navigation config, whose Phosphor icons need React context
 * (unavailable in server components).
 */
export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-card mt-16 border-t print:hidden">
      <div className={cn(SHELL_WIDTH, "py-12")}>
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-sm space-y-4">
            <Link href="/" className="focus-visible:ring-ring inline-flex rounded-[14px] focus-visible:ring-2 focus-visible:outline-none">
              <Logo className="size-12" />
            </Link>
            <p className="text-muted-foreground text-sm leading-6">
              Know where every pound goes — spending, savings goals and who owes who, in one calm place.
            </p>
            <ul className="text-muted-foreground space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <Lock size={14} weight="duotone" className="text-primary shrink-0" aria-hidden />
                Your records are private to your account.
              </li>
              <li className="flex items-center gap-2">
                <Sparkle size={14} weight="duotone" className="text-primary shrink-0" aria-hidden />
                AI answers are worked out from your own data.
              </li>
            </ul>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-sans text-sm font-semibold tracking-normal">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.url}>
                    <Link
                      href={link.url}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="text-muted-foreground mt-12 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} · Amounts in pounds sterling (GBP)</p>
          <div className="flex items-center gap-5">
            <span>
              Press <kbd className="bg-muted rounded-md border px-1.5 py-0.5 font-sans text-[10px] font-medium">⌘K</kbd> to search
            </span>
            <a href="#main-content" className="hover:text-foreground inline-flex items-center gap-1 transition-colors">
              Back to top
              <ArrowUp size={12} weight="bold" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
