import {
  ChartBar,
  ChartLine,
  Checks,
  Database,
  Gift,
  HandCoins,
  House,
  type Icon,
  PiggyBank,
  Receipt,
  Sparkle,
  Target,
  UploadSimple,
  UserCircle,
} from "@phosphor-icons/react";

export interface NavItem {
  /** One-line description, shown in menus and the ⌘K palette. */
  hint: string;
  icon: Icon;
  title: string;
  url: string;
}

export interface NavGroup {
  /** "links" render straight in the top bar; "menu" renders a dropdown. */
  display: "links" | "menu";
  items: NavItem[];
  /** Menu label / palette heading. */
  label: string;
}

/**
 * Single source of truth for app navigation: the top bar, the mobile menu,
 * the footer and the ⌘K command palette all read from here. Add new routes
 * to this list.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    display: "links",
    items: [{ hint: "Your money at a glance", icon: House, title: "Home", url: "/" }],
    label: "Overview",
  },
  {
    display: "menu",
    items: [
      { hint: "Add, edit and review expenses", icon: Receipt, title: "Expenses", url: "/expenses" },
      { hint: "Who owes who, and what's settled", icon: HandCoins, title: "Lend & borrow", url: "/lend-borrow" },
      { hint: "Things to buy and save up for", icon: Gift, title: "Wishlist", url: "/wishlist" },
      { hint: "Monthly limits per category", icon: PiggyBank, title: "Budgets", url: "/budgets" },
      { hint: "CSV or PDF bank statements", icon: UploadSimple, title: "Import", url: "/import-expenses" },
      { hint: "Debt, savings and loans", icon: Checks, title: "Trackers", url: "/trackers" },
    ],
    label: "Money",
  },
  {
    display: "menu",
    items: [
      { hint: "Salary, rent, goals and long-term savings", icon: Target, title: "Savings plan", url: "/plan" },
      { hint: "Compare periods and export reports", icon: ChartLine, title: "Analytics", url: "/analytics" },
      { hint: "Month, category and member charts", icon: ChartBar, title: "Yearly Charts", url: "/yearly-charts" },
    ],
    label: "Insights",
  },
  {
    display: "links",
    items: [{ hint: "Ask about your money in plain English", icon: Sparkle, title: "Ask AI", url: "/assistant" }],
    label: "AI",
  },
];

/** Account pages: reached from the account menu, footer and ⌘K. */
export const ACCOUNT_GROUP: NavGroup = {
  display: "menu",
  items: [
    { hint: "Name, picture, password and data", icon: UserCircle, title: "Profile", url: "/profile" },
    { hint: "Fill the app with realistic test data", icon: Database, title: "Load sample data", url: "/profile?tab=data" },
  ],
  label: "Account",
};

export const isRouteActive = (pathname: string, url: string) =>
  url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

/** Nav item and section for the current route. */
export const findNavEntry = (pathname: string) => {
  for (const group of [...NAV_GROUPS, ACCOUNT_GROUP]) {
    const item = group.items.find((i) => isRouteActive(pathname, i.url));
    if (item) return { item, section: group.label };
  }
  return null;
};
