"use client";

import {
  ChartBar,
  ChartLine,
  Checks,
  CircleNotch,
  House,
  PiggyBank,
  Receipt,
  UploadSimple,
  Wallet,
} from "@phosphor-icons/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { SidebarUserMenu } from "@/components/auth/SidebarUserMenu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";

const navItems = [
  {
    icon: House,
    title: "Home",
    url: "/",
  },
  {
    icon: Receipt,
    title: "Expenses",
    url: "/expenses",
  },
  {
    icon: PiggyBank,
    title: "Budgets",
    url: "/budgets",
  },
  {
    icon: ChartLine,
    title: "Analytics",
    url: "/analytics",
  },
  {
    icon: ChartBar,
    title: "Yearly Charts",
    url: "/yearly-charts",
  },
  {
    icon: UploadSimple,
    title: "Import",
    url: "/import-expenses",
  },
  {
    icon: Checks,
    title: "Trackers",
    url: "/trackers",
  },
];

interface AppSideBarProps {
  userEmail?: string;
  userName?: string;
}

/** "jane.doe@x.com" → "Jane Doe" when the account has no saved name. */
const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/** Spinner on the nav item whose page is loading (must render inside <Link>). */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <CircleNotch
      size={14}
      weight="bold"
      aria-hidden
      className="ml-auto shrink-0 animate-spin opacity-70 group-data-[collapsible=icon]:hidden"
    />
  );
}

const AppSideBar = ({ userEmail, userName }: AppSideBarProps) => {
  const displayName = userName || (userEmail ? nameFromEmail(userEmail) : "");
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const isRouteActive = (url: string) =>
    url === "/" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Brand header */}
      <SidebarHeader className="px-4 py-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              onClick={closeOnMobile}
              size="lg"
              tooltip="Daily Expenses"
              className="h-11 gap-3 rounded-2xl px-2 hover:bg-sidebar-accent"
            >
              <Link href="/">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-sidebar-foreground/10 shadow-sm">
                  <Wallet size={18} weight="duotone" className="text-sidebar-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
                    Daily Expenses
                  </p>
                  <p className="truncate text-[10px] font-medium text-sidebar-foreground/40">
                    Finance tracker
                  </p>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const active = isRouteActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      onClick={closeOnMobile}
                      tooltip={item.title}
                      className={
                        active
                          ? "h-10 gap-3 rounded-xl px-3 text-sm font-semibold bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90"
                          : "h-10 gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                      }
                    >
                      <Link
                        href={item.url}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon
                          size={17}
                          weight={active ? "fill" : "regular"}
                          className="shrink-0"
                        />
                        <span>{item.title}</span>
                        <NavPending />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Account: who is signed in, and a clear way to sign out */}
      {userEmail && (
        <SidebarFooter className="gap-2 px-3 pb-4">
          <SidebarSeparator className="mx-0 mb-1 bg-sidebar-border" />
          <div
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            title={`${displayName} · ${userEmail}`}
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-foreground/10 text-xs font-semibold text-sidebar-foreground"
            >
              {initialsOf(displayName) || "?"}
            </span>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
            </div>
          </div>
          <SidebarMenu>
            <SidebarUserMenu />
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
};

export default AppSideBar;
