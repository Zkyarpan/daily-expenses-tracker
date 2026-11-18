"use client";

import { ArrowUp, Lock, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { useDisplayCurrency } from "@/components/currency/CurrencyTools";
import { currencyName } from "@/lib/currency";
import { cn } from "@/lib/utils";

import { ACCOUNT_GROUP, ALL_NAV_GROUPS } from "./navigation";
import { SHELL_WIDTH } from "./styles";

const pages = (...urls: string[]) =>
  urls.flatMap((url) => ALL_NAV_GROUPS.flatMap((g) => g.items).filter((item) => item.url === url));

const money = pages("/expenses", "/budgets", "/lend-borrow", "/wishlist", "/trackers", "/import-expenses");
const insights = pages("/plan", "/analytics", "/yearly-charts", "/assistant", "/rates");
const account = [
  ACCOUNT_GROUP.items[0],
  { title: "Password & security", url: "/profile?tab=security" },
  { title: "Export your data", url: "/profile?tab=data" },
  { title: "Appearance & currency", url: "/profile?tab=preferences" },
  { title: "Notifications", url: "/profile?tab=notifications" },
  { title: "Help & FAQs", url: "/help" },
  { title: "Report a problem", url: "/help#report" },
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
  const currency = useDisplayCurrency();

  return (
    <footer className="bg-card mt-12 border-t pb-[env(safe-area-inset-bottom)] sm:mt-16 print:hidden">
      <div className={cn(SHELL_WIDTH, "py-10 sm:py-12")}>
        {/* Phones: brand on top, link columns two-up beneath it. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="col-span-2 max-w-sm space-y-4 sm:col-span-3 md:col-span-1">
            <Link href="/" className="focus-visible:ring-ring inline-flex rounded-[14px] focus-visible:ring-2 focus-visible:outline-none">
              <Logo className="size-10 sm:size-12" />
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
              <ul className="mt-3 space-y-1 sm:mt-4 sm:space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.url}>
                    {/* Taller rows on phones: easier to tap. */}
                    <Link
                      href={link.url}
                      className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center text-sm transition-colors sm:min-h-0"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="text-muted-foreground mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} · Amounts in {currencyName(currency)} ({currency})
          </p>
          <div className="flex items-center gap-5">
            {/* Keyboard shortcut: not useful on touch screens. */}
            <span className="pointer-coarse:hidden">
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
