"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  CaretDown,
  Gift,
  Lifebuoy,
  List,
  MagnifyingGlass,
  Plus,
  Receipt,
  UploadSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { Logo } from "@/components/brand/Logo";
import { useHelp } from "@/components/help/HelpCenter";
import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getIsDemoMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { AccountMenu, openSearch } from "./AccountMenu";
import { CommandPalette } from "./CommandPalette";
import { isItemActive, NAV_GROUPS, type NavGroup, tourId } from "./navigation";
import { BAR_ICON_BUTTON, SHELL_WIDTH } from "./styles";
import { ModeToggle, ThemeMenuRow } from "./ThemeButton";

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
    "focus-visible:ring-ring relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

// ─────────────────────────────────────────────────────────────────────────────
// Desktop: direct links plus one small "More" menu (opens on hover or click)
// ─────────────────────────────────────────────────────────────────────────────

function NavMenu({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = group.items.some((item) => isItemActive(pathname, item));

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
        className="w-72 rounded-2xl p-1.5"
      >
        {group.items.map((item) => {
          const current = isItemActive(pathname, item);
          return (
            <DropdownMenuItem key={item.url} asChild className="cursor-pointer rounded-xl p-2">
              <Link href={item.url} aria-current={current ? "page" : undefined} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    current ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <item.icon size={16} weight={current ? "fill" : "regular"} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", current && "text-primary")}>{item.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">{item.hint}</span>
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
    <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
      {NAV_GROUPS.map((group) =>
        group.display === "menu" ? (
          <NavMenu key={group.label} group={group} pathname={pathname} />
        ) : (
          group.items.map((item) => {
            const active = isItemActive(pathname, item);
            const featured = item.url === "/assistant";
            return (
              <Link
                key={item.url}
                href={item.url}
                aria-current={active ? "page" : undefined}
                className={linkClass(active)}
                data-tour={tourId(item.url)}
              >
                {featured && <item.icon size={15} weight="fill" className={active ? "" : "text-primary"} aria-hidden />}
                {item.title}
              </Link>
            );
          })
        ),
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile: the same pages in a sheet
// ─────────────────────────────────────────────────────────────────────────────

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const { openHelp } = useHelp();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={cn(BAR_ICON_BUTTON, "lg:hidden")} aria-label="Open menu" data-tour="menu">
          <List size={20} weight="bold" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,86vw)] gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center">
            <Logo className="size-9" />
          </SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="space-y-4 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {group.display === "menu" && (
                <p className="text-muted-foreground px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">{group.label}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item);
                  return (
                    <li key={item.url}>
                      <Link
                        href={item.url}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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
        {/* On phones the theme switch lives here instead of the top bar. */}
        <div className="mt-auto space-y-0.5 border-t px-3 py-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openSearch();
            }}
            className="hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <MagnifyingGlass size={18} aria-hidden />
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openHelp();
            }}
            className="hover:bg-muted flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <Lifebuoy size={18} aria-hidden />
            Help &amp; questions
          </button>
          <ThemeMenuRow />
        </div>
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
        <Button size="sm" className="h-9 min-w-9 gap-1.5 px-2.5 shadow-sm sm:px-3.5" aria-label="Add new" data-tour="new">
          <Plus size={15} weight="bold" aria-hidden />
          <span className="hidden sm:inline">New</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-60 rounded-xl p-1.5">
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
            <DropdownMenuItem onSelect={() => openIou({ direction: "lent" })}>
              <ArrowUpRight aria-hidden />
              Money I lent
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openIou({ direction: "borrowed" })}>
              <ArrowDownLeft aria-hidden />
              Money I borrowed
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openWishlist()}>
              <Gift aria-hidden />
              Wishlist item
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/import-expenses">
            <UploadSimple aria-hidden />
            Import a statement
          </Link>
        </DropdownMenuItem>
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
        className="text-muted-foreground hover:text-foreground hidden h-9 w-48 justify-start gap-2 rounded-full border px-3 text-sm font-normal xl:inline-flex"
      >
        <MagnifyingGlass size={15} weight="bold" className="shrink-0" aria-hidden />
        <span className="truncate">Search…</span>
        <kbd className="bg-muted text-muted-foreground ml-auto rounded-md border px-1.5 py-0.5 font-sans text-[10px] leading-none font-medium">
          ⌘K
        </kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Search (⌘K)" className={cn(BAR_ICON_BUTTON, "xl:hidden")} data-tour="search">
        <MagnifyingGlass size={18} weight="bold" aria-hidden />
      </Button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar
// ─────────────────────────────────────────────────────────────────────────────

/** True once the page has scrolled, to give the pinned bar a soft shadow. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

/** Top bar, pinned to the top of the window at all times. */
const Navbar = () => {
  const pathname = usePathname();
  const scrolled = useScrolled();

  return (
    <header
      aria-label="Application header"
      className={cn(
        // Solid on phones: a backdrop blur on a sticky bar makes scrolling janky
        // on low-end devices. Frosted glass from sm up.
        "bg-card sm:supports-[backdrop-filter]:bg-card/80 sticky top-0 z-40 border-b transition-shadow duration-200 sm:backdrop-blur-xl print:hidden",
        scrolled && "shadow-sm",
      )}
    >
      <div className={cn(SHELL_WIDTH, "flex h-14 items-center gap-1.5 sm:h-16 sm:gap-2")}>
        <MobileNav pathname={pathname} />
        <Link
          href="/"
          data-tour="home"
          aria-label="Home"
          className="focus-visible:ring-ring mr-1 shrink-0 rounded-[12px] transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:outline-none lg:mr-3"
        >
          <Logo className="size-8 sm:size-9" />
        </Link>
        <DesktopNav pathname={pathname} />

        <CommandPalette />

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          <QuickAddMenu />
          <SearchButton />
          <span className="flex" data-tour="alerts">
            <AlertsBell />
          </span>
          <ModeToggle className="hidden sm:inline-flex" />
          <span className="ml-0.5 flex sm:ml-1" data-tour="account">
            <AccountMenu />
          </span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
