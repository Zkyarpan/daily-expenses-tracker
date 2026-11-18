import {
  ChartBar,
  ChartLine,
  Checks,
  CurrencyCircleDollar,
  Database,
  Gift,
  HandCoins,
  House,
  type Icon,
  Lifebuoy,
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
  /** Sub-pages reached from this one, which keep its link highlighted. */
  related?: string[];
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
 *
 * Kept deliberately flat: the pages people use most are direct links, and a
 * single small "More" menu holds the rest. Import and Yearly charts are not
 * in the bar — they open from inside Expenses and Analytics (and ⌘K/footer).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    display: "links",
    items: [
      { hint: "Your money at a glance", icon: House, title: "Home", url: "/" },
      {
        hint: "Add, edit and review expenses",
        icon: Receipt,
        related: ["/import-expenses"],
        title: "Expenses",
        url: "/expenses",
      },
      { hint: "Monthly limits per category", icon: PiggyBank, title: "Budgets", url: "/budgets" },
      { hint: "Salary, bills, goals and what's left", icon: Target, title: "Plan", url: "/plan" },
      {
        hint: "Compare periods and export reports",
        icon: ChartLine,
        related: ["/yearly-charts"],
        title: "Analytics",
        url: "/analytics",
      },
    ],
    label: "Pages",
  },
  {
    display: "menu",
    items: [
      { hint: "Who owes who, and what's settled", icon: HandCoins, title: "Lend & borrow", url: "/lend-borrow" },
      { hint: "Things to buy and save up for", icon: Gift, title: "Wishlist", url: "/wishlist" },
      { hint: "Debt, savings and loans", icon: Checks, title: "Trackers", url: "/trackers" },
    ],
    label: "More",
  },
  {
    display: "links",
    items: [{ hint: "Ask about your money in plain English", icon: Sparkle, title: "Ask AI", url: "/assistant" }],
    label: "AI",
  },
];

/** Opened from inside pages (Expenses → Import, Analytics → Yearly charts), the footer and ⌘K. */
export const TOOLS_GROUP: NavGroup = {
  display: "menu",
  items: [
    { hint: "CSV or PDF bank statements", icon: UploadSimple, title: "Import", url: "/import-expenses" },
    { hint: "Month, category and member charts", icon: ChartBar, title: "Yearly charts", url: "/yearly-charts" },
    { hint: "GBP, USD, NPR and more — rates and a converter", icon: CurrencyCircleDollar, title: "Exchange rates", url: "/rates" },
  ],
  label: "Tools",
};

/** Account pages: reached from the account menu, footer and ⌘K. */
export const ACCOUNT_GROUP: NavGroup = {
  display: "menu",
  items: [
    { hint: "Name, picture, password and data", icon: UserCircle, title: "Profile", url: "/profile" },
    { hint: "Fill the app with realistic test data", icon: Database, title: "Load sample data", url: "/profile?tab=data" },
    { hint: "FAQs, the tour and report a problem", icon: Lifebuoy, title: "Help & support", url: "/help" },
  ],
  label: "Account",
};

/** Every page, for the ⌘K palette. */
export const ALL_NAV_GROUPS: NavGroup[] = [...NAV_GROUPS, TOOLS_GROUP, ACCOUNT_GROUP];

/** `data-tour` id for a nav link, targeted by the product tour (e.g. "nav-expenses"). */
export const tourId = (url: string) => `nav-${url === "/" ? "home" : url.slice(1)}`;

export const isRouteActive = (pathname: string, url: string) =>
  url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

/** True on the item's own page and on its related sub-pages. */
export const isItemActive = (pathname: string, item: NavItem) =>
  [item.url, ...(item.related ?? [])].some((url) => isRouteActive(pathname, url));

/** Nav item and section for the current route. */
export const findNavEntry = (pathname: string) => {
  for (const group of ALL_NAV_GROUPS) {
    const item = group.items.find((i) => isRouteActive(pathname, i.url));
    if (item) return { item, section: group.label };
  }
  return null;
};
