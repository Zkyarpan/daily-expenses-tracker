"use client";

import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  ListChecks,
  PiggyBank,
  ReceiptText,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarUserMenu } from "@/components/auth/SidebarUserMenu";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";

const primaryItems = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    url: "/",
  },
  {
    icon: ReceiptText,
    title: "Expenses",
    url: "/expenses",
  },
  {
    icon: PiggyBank,
    title: "Budgets",
    url: "/budgets",
  },
  {
    icon: LineChart,
    title: "Analytics",
    url: "/analytics",
  },
  {
    icon: BarChart3,
    title: "Yearly charts",
    url: "/yearly-charts",
  },
  {
    icon: Upload,
    title: "Import Expenses",
    url: "/import-expenses",
  },
];

interface AppSideBarProps {
  userEmail?: string;
}

const AppSideBar = ({ userEmail }: AppSideBarProps) => {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const isRouteActive = (url: string) =>
    url === "/" ? pathname === url : pathname === url || pathname.startsWith(`${url}/`);

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              onClick={closeOnMobile}
              size="lg"
              tooltip="Daily Expenses"
            >
              <Link href="/">
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Wallet className="size-4" />
                </span>
                <span className="font-semibold tracking-tight">Daily Expenses</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isRouteActive(item.url)}
                    onClick={closeOnMobile}
                    tooltip={item.title}
                  >
                    <Link href={item.url} aria-current={isRouteActive(item.url) ? "page" : undefined}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRouteActive("/trackers")}
                  onClick={closeOnMobile}
                  tooltip="Misc trackers"
                >
                  <Link
                    href="/trackers"
                    aria-current={isRouteActive("/trackers") ? "page" : undefined}
                  >
                    <ListChecks /> <span>Misc trackers</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4">
        <SidebarSeparator className="mb-2" />
        <SidebarMenu>
          {userEmail && <SidebarUserMenu />}
        </SidebarMenu>
        <div className="text-sidebar-foreground/50 mt-2 px-2 text-xs leading-5 group-data-[collapsible=icon]:hidden">
          {userEmail ?? "Personal finance workspace"}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSideBar;
