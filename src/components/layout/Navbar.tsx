"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CaretDown,
  Gift,
  List,
  MagnifyingGlass,
  Plus,
  Receipt,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { Logo } from "@/components/brand/Logo";
import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getIsDemoMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { AccountMenu, openSearch } from "./AccountMenu";
import { CommandPalette } from "./CommandPalette";
import { isRouteActive, NAV_GROUPS, type NavGroup } from "./navigation";
import { ModeToggle } from "./ThemeButton";

/** Shared layout width, so the bar lines up with page content and the footer. */
export const SHELL_WIDTH = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8";

function AlertsBell() {
  const { alerts, unreadCount, markAsRead, markAllAsRead, dismiss, dismissAll } = useAlerts();
  return (
    <AlertsPanel
      alerts={alerts}
      unreadCount={unreadCount}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onDismiss={dismiss}
      onDismissAll={dismissAll}
    />
  );
}

const linkClass = (active: boolean) =>
  cn(
    "focus-visible:ring-ring relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

// ─────────────────────────────────────────────────────────────────────────────
// Desktop: direct links and dropdown menus (open on hover or click)
// ─────────────────────────────────────────────────────────────────────────────

function NavMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = group.items.some((item) => isRouteActive(pathname, item.url));
  const wide = group.items.length > 4;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const openNow = () => {
    clear();
    setOpen(true);
  };
  const closeSoon = () => {
    clear();
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => clear, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        data-tour={group.label.toLowerCase()}
        className={cn(linkClass(active), "data-[state=open]:bg-muted data-[state=open]:text-foreground")}
        onPointerEnter={(e) => e.pointerType === "mouse" && openNow()}
        onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
        // A click after hover-opening shouldn't close it again.
        onPointerDown={(e) => {
          if (open && e.pointerType === "mouse") e.preventDefault();
        }}
      >
        {group.label}
        <CaretDown size={12} weight="bold" className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={10}
        onPointerEnter={openNow}
        onPointerLeave={closeSoon}
        className={cn("rounded-2xl p-2", wide ? "grid w-[34rem] grid-cols-2 gap-1" : "w-80")}
      >
        {group.items.map((item) => {
          const current = isRouteActive(pathname, item.url);
          return (
            <DropdownMenuItem key={item.url} asChild className="cursor-pointer rounded-xl p-2.5">
              <Link href={item.url} aria-current={current ? "page" : undefined} className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    current ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <item.icon size={18} weight={current ? "fill" : "regular"} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", current && "text-primary")}>{item.title}</span>
                  <span className="text-muted-foreground block text-xs leading-5">{item.hint}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {NAV_GROUPS.map((group) =>
        group.display === "menu" ? (
          <NavMenu key={group.label} group={group} pathname={pathname} />
        ) : (
          group.items.map((item) => {
            const active = isRouteActive(pathname, item.url);
            const featured = item.url === "/assistant";
            return (
              <Link
                key={item.url}
                href={item.url}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
                data-tour={featured ? "ask-ai" : undefined}
              >
                {featured && <item.icon size={15} weight="fill" className={active ? "" : "text-primary"} aria-hidden />}
                {item.title}
                {featured && !active && <span className="bg-highlight size-1.5 rounded-full" aria-hidden />}
              </Link>
            );
          })
        ),
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile: full menu in a sheet
// ─────────────────────────────────────────────────────────────────────────────

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 lg:hidden" aria-label="Open menu" data-tour="menu">
          <List size={20} weight="bold" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[19rem] overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center">
            <Logo className="size-10" />
          </SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="space-y-5 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {group.display === "menu" && (
                <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">{group.label}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.url);
                  return (
                    <li key={item.url}>
                      <Link
                        href={item.url}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                        )}
                      >
                        <item.icon size={18} weight={active ? "fill" : "regular"} aria-hidden />
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** "+ New": add an expense, scan a receipt, an IOU or a wishlist item from any page. */
function QuickAddMenu() {
  const { openExpense, openIou, openReceiptScan, openWishlist } = useQuickAdd();
  const signedIn = !getIsDemoMode();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 px-3.5 shadow-sm" aria-label="Add new" data-tour="new">
          <Plus size={15} weight="bold" aria-hidden />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 rounded-xl p-1.5">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">Add</DropdownMenuLabel>
        <DropdownMenuItem onSelect={openExpense}>
          <Receipt aria-hidden />
          Expense
        </DropdownMenuItem>
        {signedIn && (
          <>
            <DropdownMenuItem onSelect={openReceiptScan}>
              <Camera aria-hidden />
              Scan a receipt
              <span className="bg-highlight text-highlight-foreground ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold">AI</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openIou({ direction: "lent" })}>
              <ArrowUpRight aria-hidden />
              Money I lent
              <span className="text-muted-foreground ml-auto text-xs">they owe me</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openIou({ direction: "borrowed" })}>
              <ArrowDownLeft aria-hidden />
              Money I borrowed
              <span className="text-muted-foreground ml-auto text-xs">I owe</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openWishlist()}>
              <Gift aria-hidden />
              Wishlist item
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchButton() {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openSearch}
        aria-label="Search and jump to a page (⌘K)"
        data-tour="search"
        className="text-muted-foreground hover:text-foreground hidden h-9 w-52 justify-start gap-2 rounded-full px-3 text-sm font-normal xl:inline-flex"
      >
        <MagnifyingGlass size={15} weight="bold" className="shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="bg-muted text-muted-foreground ml-auto rounded-md border px-1.5 py-0.5 font-sans text-[10px] leading-none font-medium">
          ⌘K
        </kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Search (⌘K)" className="size-9 xl:hidden" data-tour="search">
        <MagnifyingGlass size={17} weight="bold" aria-hidden />
      </Button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slides the bar away while you scroll down to read, and back as soon as you
 * scroll up. Stays put near the top, while a menu is open, while it has
 * keyboard focus, and during the app tour.
 */
function useHideOnScroll(header: React.RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        const el = header.current;
        const pinned =
          y < 96 ||
          document.body.dataset.tourActive === "true" ||
          Boolean(el?.querySelector('[data-state="open"]')) ||
          Boolean(el?.contains(document.activeElement) && document.activeElement !== document.body);
        if (pinned || delta < -8) setHidden(false);
        else if (delta > 8) setHidden(true);
        if (Math.abs(delta) > 8) last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [header]);

  return [hidden, setHidden] as const;
}

const Navbar = () => {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useHideOnScroll(headerRef);

  return (
    <header
      ref={headerRef}
      aria-label="Application header"
      data-hidden={hidden || undefined}
      // Tabbing into a hidden bar brings it back.
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-40 border-b backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none print:hidden",
        hidden && "-translate-y-full",
      )}
    >
      <div className={cn(SHELL_WIDTH, "flex h-16 items-center gap-2")}>
        <MobileNav pathname={pathname} />
        <Link
          href="/"
          data-tour="home"
          className="focus-visible:ring-ring mr-2 rounded-[12px] transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:outline-none lg:mr-4"
        >
          <Logo className="size-10" />
        </Link>
        <DesktopNav pathname={pathname} />

        <CommandPalette />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <QuickAddMenu />
          <SearchButton />
          <span className="flex" data-tour="alerts">
            <AlertsBell />
          </span>
          <ModeToggle />
          <span className="flex" data-tour="account">
            <AccountMenu />
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
