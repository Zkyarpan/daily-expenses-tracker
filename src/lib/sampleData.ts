/**
 * src/lib/sampleData.ts
 *
 * Generates a realistic sample dataset so every feature can be tried on a
 * real account: ~2 years of expenses (bills, groceries, takeaways, fuel,
 * trips, Christmas, refunds and a few uncategorised rows), monthly budgets
 * for the last six months (some near or over their limit, so spending alerts
 * fire), four debt/savings trackers, IOUs with friends and family (open,
 * part-paid, overdue and settled) and a wishlist.
 *
 * Amounts and dates are deterministic for a given day, so the data looks the
 * same every time it is loaded. Row ids are random but always start with
 * SAMPLE_ID_PREFIX, which is how "Remove sample data" finds exactly these
 * rows and never touches the user's own records.
 *
 * Pure module: no Supabase access (see src/lib/supabase/sampleData.ts).
 */

export const SAMPLE_ID_PREFIX = "5a3d1e00";
export const SAMPLE_ID_MIN = `${SAMPLE_ID_PREFIX}-0000-0000-0000-000000000000`;
export const SAMPLE_ID_MAX = `${SAMPLE_ID_PREFIX}-ffff-ffff-ffff-ffffffffffff`;

export type SampleExpense = {
  amount: number;
  categoryId: string | null;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  id: string;
  memberId: string | null;
  tagId: string | null;
};

export type SampleBudget = {
  categoryId: string;
  id: string;
  limitAmount: number;
  month: number;
  year: number;
};

export type SampleTrackerEntry = {
  balance: number;
  credit: number;
  date: string;
  debit: number;
  description: string;
  id: string;
};

export type SampleTracker = {
  color: string;
  currentBalance: number;
  description: string;
  entries: SampleTrackerEntry[];
  id: string;
  initialBalance: number;
  title: string;
};

export type SampleIou = {
  amount: number;
  date: string;
  description: string;
  direction: "borrowed" | "lent";
  dueDate: string | null;
  id: string;
  paidAmount: number;
  person: string;
};

export type SampleWishlistItem = {
  categoryId: string;
  id: string;
  name: string;
  notes: string | null;
  price: number;
  priority: "high" | "low" | "medium";
  purchasedAt: string | null;
  savedAmount: number;
  targetDate: string | null;
};

export type SampleFixedCost = { amount: number; dueDay: number | null; id: string; name: string };
export type SampleGoal = { id: string; name: string; savedAmount: number; targetAmount: number; targetDate: string | null };

export type SampleDataset = {
  budgets: SampleBudget[];
  expenses: SampleExpense[];
  /** Savings plan: rent and bills (named like their expenses, so they aren't counted twice). */
  fixedCosts: SampleFixedCost[];
  /** Savings plan: long-term goals. */
  goals: SampleGoal[];
  /** Money lent to / borrowed from people. */
  ious: SampleIou[];
  /** Number of calendar months the expenses cover. */
  months: number;
  trackers: SampleTracker[];
  wishlist: SampleWishlistItem[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Random hex from the platform CSPRNG (ids must be unique across accounts). */
const randomHex = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2))), (b) =>
    b.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, length);

/** UUID-shaped id in the sample namespace (version 4, RFC 4122 variant). */
export const sampleId = () =>
  `${SAMPLE_ID_PREFIX}-${randomHex(4)}-4${randomHex(3)}-${"89ab"[crypto.getRandomValues(new Uint8Array(1))[0] % 4]}${randomHex(3)}-${randomHex(12)}`;

export const isSampleId = (id: string) => id.startsWith(`${SAMPLE_ID_PREFIX}-`);

/** Seeded PRNG (mulberry32) so the generated amounts are repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary (category ids and tag ids match src/lib/config.ts)
// ─────────────────────────────────────────────────────────────────────────────

const GROCERY = ["Weekly groceries", "Big weekly shop", "Groceries and household", "Fresh produce and meat", "Family food shop"];
const GROCERY_TAGS = ["costco", "aldi", "walmart", "giant-eagle", "sams-club"];
const TAKEOUT = ["Friday pizza", "Lunch near the office", "Takeaway curry", "Coffee and pastries", "Dinner out with family", "Burgers after the cinema", "Sushi night"];
const TAKEOUT_TAGS = ["pitts-halal-brothers", "joe-and-pie", "98k", "others"];
const PETROL = ["Fuel – Shell", "Fuel – BP", "Fuel – Tesco Esso", "Fuel – Sainsbury's"];
const SHOPPING = ["Winter jacket", "Kitchen supplies", "Phone case and charger", "Books", "Running trainers", "Bedding set", "Kids' school clothes", "Headphones", "Home décor", "Office chair cushion"];
const SHOPPING_TAGS = ["amazon", "shein", "walmart", "others"];
const BIRTHDAY_GIFTS = ["Birthday gift for Mum", "Birthday present for a friend", "Anniversary flowers", "Nephew's birthday present"];
const CHRISTMAS_GIFTS = ["Christmas presents – family", "Secret Santa gift", "Christmas hamper", "Stocking fillers"];

const TRAVEL: Record<number, { day: number; description: string; max: number; min: number }[]> = {
  11: [{ day: 21, description: "Train home for Christmas", max: 110, min: 84 }],
  3: [{ day: 11, description: "Train to London (Easter)", max: 96, min: 72 }],
  6: [
    { day: 19, description: "Flights to Lisbon", max: 340, min: 280 },
    { day: 20, description: "Hotel – Lisbon, 4 nights", max: 460, min: 380 },
    { day: 27, description: "Airport parking", max: 52, min: 38 },
  ],
  9: [
    { day: 9, description: "Train to Edinburgh", max: 160, min: 120 },
    { day: 10, description: "Hotel – Edinburgh, 2 nights", max: 240, min: 180 },
  ],
};

/** Monthly limits: utilities are set a little tight so the alert path is visible. */
const BUDGET_LIMITS: [categoryId: string, limit: number][] = [
  ["1", 480],
  ["2", 160],
  ["3", 110],
  ["4", 200],
  ["7", 230],
  ["8", 330],
  ["9", 120],
];

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateSampleData(today: Date = new Date()): SampleDataset {
  const rand = seeded(20_261_117);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const between = (min: number, max: number) => round2(min + rand() * (max - min));
  const chance = (p: number) => rand() < p;
  const randomMember = () => {
    const r = rand();
    return r < 0.6 ? "1" : r < 0.95 ? "2" : null;
  };

  const endYear = today.getFullYear();
  const endMonth = today.getMonth();
  const endDay = today.getDate();
  const startYear = endYear - 1;

  // ── Expenses: 1 January last year → today ────────────────────────────────
  const expenses: SampleExpense[] = [];
  let months = 0;

  for (let year = startYear; year <= endYear; year++) {
    const lastMonth = year === endYear ? endMonth : 11;
    for (let m = 0; m <= lastMonth; m++) {
      months++;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const lastDay = year === endYear && m === endMonth ? endDay : daysInMonth;
      const randomDay = () => 1 + Math.floor(rand() * daysInMonth);
      const add = (
        day: number,
        categoryId: string | null,
        amount: number,
        description: string,
        tagId: string | null = null,
        memberId: string | null = randomMember(),
      ) => {
        const value = round2(amount);
        if (day < 1 || day > lastDay || value === 0) return;
        expenses.push({ amount: value, categoryId, date: isoDate(year, m, day), description, id: sampleId(), memberId, tagId });
      };

      const winter = m <= 1 || m >= 10;
      const summer = m >= 5 && m <= 7;

      // Household bills
      add(1, "8", winter ? between(98, 132) : summer ? between(52, 68) : between(70, 92), "Electricity & gas – Octopus Energy", "others", "1");
      add(4, "8", 36.4, "Water – Thames Water", "others", "1");
      add(8, "8", 32.99, "Broadband – BT Fibre", "others", "1");
      add(12, "8", 21.99, "Mobile plan – giffgaff", "others", "2");
      add(15, "8", 148, "Council tax", "others", "1");

      // Car
      add(3, "9", 68.4, "Car insurance – Admiral", "others", "1");
      if (m === 3) add(18, "9", between(210, 260), "Annual car service", "tire-shop", "1");
      if (m === 9) add(21, "9", 54.85, "MOT test", "tire-shop", "1");
      if (year === endYear && m === 1) add(9, "9", 212, "Two new front tyres", "tire-shop", "1");

      // Groceries: a weekly shop plus top-ups (bigger in December)
      for (const day of [2, 9, 16, 23, 30]) {
        add(day, "1", between(62, 138) * (m === 11 ? 1.2 : 1), pick(GROCERY), pick(GROCERY_TAGS));
      }
      for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) {
        add(randomDay(), "1", between(6, 24), "Top-up shop", "aldi");
      }

      // Takeaways and eating out
      for (let i = 0, n = 4 + Math.floor(rand() * 4) + (m === 11 ? 2 : 0); i < n; i++) {
        add(randomDay(), "2", between(9, 48), pick(TAKEOUT), pick(TAKEOUT_TAGS));
      }

      // Fuel
      for (const day of [6, 14, 22, 29]) {
        if (day === 29 && !chance(0.5)) continue;
        add(day + Math.floor(rand() * 2), "7", between(46, 74), pick(PETROL), "others");
      }

      // London transport: a monthly Oyster top-up and contactless journeys
      add(2, "5", 20, "TfL – Oyster top-up", "others");
      for (let i = 0, n = 5 + Math.floor(rand() * 5); i < n; i++) {
        add(randomDay(), "5", pick([2.8, 2.8, 2.8, 3.5, 5.6, 8.1]), pick(["TfL – Tube journey", "TfL – Bus fare", "TfL – Daily cap"]), "others");
      }

      // Shopping (Black Friday and Christmas are busier) and the odd refund
      const blackFridayOrChristmas = m === 10 || m === 11;
      for (let i = 0, n = 1 + Math.floor(rand() * 3) + (blackFridayOrChristmas ? 2 : 0); i < n; i++) {
        add(randomDay(), "4", between(16, blackFridayOrChristmas ? 180 : 120), pick(SHOPPING), pick(SHOPPING_TAGS));
      }
      if (chance(0.3)) add(randomDay(), "4", -between(12, 55), "Refund – returned item", "amazon");

      // Misc
      add(1, "3", 29.99, "Gym membership", "others", "2");
      if (chance(0.7)) add(randomDay(), "3", 18, "Haircut", "others");
      if (chance(0.6)) add(randomDay(), "3", between(6, 24), "Pharmacy", "others");
      if (chance(0.5)) add(randomDay(), "3", between(3.5, 12), "Parking", "others");

      // Gifts
      if (m === 2 || m === 5 || m === 8) add(randomDay(), "6", between(25, 85), pick(BIRTHDAY_GIFTS), "amazon");
      if (m === 11) {
        for (let i = 0; i < 4; i++) add(4 + i * 4, "6", between(20, 120), pick(CHRISTMAS_GIFTS), pick(["amazon", "others"]));
      }

      // Trips
      for (const trip of TRAVEL[m] ?? []) add(trip.day, "5", between(trip.min, trip.max), trip.description, "others", "1");

      // One uncategorised row a month, to exercise the "Uncategorized" paths
      add(randomDay(), null, between(20, 60), "Cash withdrawal", null);
    }
  }

  // ── Budgets: the last six months, including this one ─────────────────────
  const budgets: SampleBudget[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(endYear, endMonth - k, 1);
    for (const [categoryId, limitAmount] of BUDGET_LIMITS) {
      budgets.push({ categoryId, id: sampleId(), limitAmount, month: d.getMonth() + 1, year: d.getFullYear() });
    }
  }

  // ── Trackers ──────────────────────────────────────────────────────────────
  /** Date `k` months before today on `day` (clamped), or null if in the future. */
  const monthsAgo = (k: number, day: number) => {
    const first = new Date(endYear, endMonth - k, 1);
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const d = Math.min(day, dim);
    if (k === 0 && d > endDay) return null;
    return isoDate(first.getFullYear(), first.getMonth(), d);
  };

  const buildTracker = (
    base: Omit<SampleTracker, "currentBalance" | "entries" | "id">,
    moves: { credit?: number; date: string | null; debit?: number; description: string }[],
  ): SampleTracker => {
    let balance = base.initialBalance;
    const entries = moves
      .filter((move): move is typeof move & { date: string } => move.date !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((move) => {
        const debit = move.debit ?? 0;
        const credit = move.credit ?? 0;
        balance = round2(balance + debit - credit);
        return { balance, credit, date: move.date, debit, description: move.description, id: sampleId() };
      });
    return { ...base, currentBalance: balance, entries, id: sampleId() };
  };

  const range = (n: number) => Array.from({ length: n }, (_, i) => n - 1 - i); // n-1 … 0

  const trackers: SampleTracker[] = [
    buildTracker(
      {
        color: "oklch(0.72 0.20 15)",
        description: "Paying down the Barclaycard balance",
        initialBalance: -2400,
        title: "Credit card",
      },
      range(10).flatMap((k) => [
        { date: monthsAgo(k, 25), debit: 250, description: "Monthly payment" },
        ...(chance(0.7) ? [{ credit: between(60, 180), date: monthsAgo(k, 12), description: "New card purchases" }] : []),
      ]),
    ),
    buildTracker(
      {
        color: "oklch(0.65 0.20 145)",
        description: "Three months of essential costs",
        initialBalance: 1500,
        title: "Emergency fund",
      },
      [
        ...range(12).map((k) => ({ date: monthsAgo(k, 28), debit: 200, description: "Monthly transfer" })),
        { credit: 350, date: monthsAgo(4, 14), description: "Boiler repair" },
      ],
    ),
    buildTracker(
      {
        color: "oklch(0.62 0.20 240)",
        description: "Five-year car finance",
        initialBalance: -8600,
        title: "Car loan",
      },
      range(12).map((k) => ({ date: monthsAgo(k, 1), debit: 245, description: "Monthly repayment" })),
    ),
    buildTracker(
      {
        color: "oklch(0.70 0.22 35)",
        description: "Saving for a trip to Japan",
        initialBalance: 0,
        title: "Holiday fund – Japan",
      },
      [
        ...range(8).map((k) => ({ date: monthsAgo(k, 20), debit: 150, description: "Monthly saving" })),
        { date: monthsAgo(3, 6), debit: 300, description: "Birthday money" },
      ],
    ),
  ];

  // ── Lend & borrow ─────────────────────────────────────────────────────────
  /** Date `days` from today (negative = in the past). */
  const daysFromToday = (days: number) => {
    const d = new Date(endYear, endMonth, endDay + days);
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const iou = (fields: Omit<SampleIou, "id">): SampleIou => ({ ...fields, id: sampleId() });

  const ious: SampleIou[] = [
    iou({ amount: 120, date: daysFromToday(-24), description: "Concert tickets", direction: "lent", dueDate: daysFromToday(10), paidAmount: 40, person: "Sara" }),
    iou({ amount: 25, date: daysFromToday(-40), description: "Taxi home", direction: "lent", dueDate: daysFromToday(-12), paidAmount: 0, person: "Tom" }),
    iou({ amount: 45.5, date: daysFromToday(-6), description: "Dinner split", direction: "lent", dueDate: null, paidAmount: 0, person: "Priya" }),
    iou({ amount: 300, date: daysFromToday(-30), description: "Help with the deposit", direction: "borrowed", dueDate: daysFromToday(45), paidAmount: 100, person: "Mum" }),
    iou({ amount: 60, date: daysFromToday(-9), description: "Festival ticket", direction: "borrowed", dueDate: daysFromToday(5), paidAmount: 0, person: "Jake" }),
    iou({ amount: 50, date: daysFromToday(-75), description: "Birthday present (shared)", direction: "lent", dueDate: null, paidAmount: 50, person: "Ali" }),
    iou({ amount: 80, date: daysFromToday(-60), description: "Car repair", direction: "borrowed", dueDate: null, paidAmount: 80, person: "Sara" }),
  ];

  // ── Wishlist ──────────────────────────────────────────────────────────────
  const wish = (fields: Omit<SampleWishlistItem, "id">): SampleWishlistItem => ({ ...fields, id: sampleId() });

  const wishlist: SampleWishlistItem[] = [
    wish({ categoryId: "4", name: "Noise-cancelling headphones", notes: "Sony WH-1000XM5, black", price: 279, priority: "high", purchasedAt: null, savedAmount: 120, targetDate: daysFromToday(40) }),
    wish({ categoryId: "4", name: "Air fryer", notes: null, price: 89.99, priority: "medium", purchasedAt: null, savedAmount: 89.99, targetDate: null }),
    wish({ categoryId: "5", name: "Weekend in Edinburgh", notes: "Train + 2 nights", price: 350, priority: "low", purchasedAt: null, savedAmount: 50, targetDate: daysFromToday(120) }),
    wish({ categoryId: "4", name: "Running watch", notes: null, price: 199, priority: "medium", purchasedAt: null, savedAmount: 0, targetDate: null }),
    wish({ categoryId: "4", name: "Winter coat", notes: "Navy, size M", price: 140, priority: "high", purchasedAt: daysFromToday(-20), savedAmount: 140, targetDate: null }),
  ];

  // ── Savings plan ──────────────────────────────────────────────────────────
  const fixedCosts: SampleFixedCost[] = [
    { amount: 340, dueDay: 1, id: sampleId(), name: "Rent" },
    { amount: 148, dueDay: 15, id: sampleId(), name: "Council tax" },
    { amount: 32.99, dueDay: 8, id: sampleId(), name: "Broadband" },
    { amount: 21.99, dueDay: 12, id: sampleId(), name: "Mobile plan" },
    { amount: 29.99, dueDay: 1, id: sampleId(), name: "Gym membership" },
  ];
  const goals: SampleGoal[] = [
    { id: sampleId(), name: "Emergency fund", savedAmount: 850, targetAmount: 3000, targetDate: daysFromToday(365) },
    { id: sampleId(), name: "Summer holiday", savedAmount: 150, targetAmount: 800, targetDate: daysFromToday(240) },
    { id: sampleId(), name: "New laptop", savedAmount: 0, targetAmount: 900, targetDate: null },
  ];

  return { budgets, expenses, fixedCosts, goals, ious, months, trackers, wishlist };
}
