/**
 * src/lib/site.ts — one place for the name, description and URL used by SEO
 * metadata, the web-app manifest, robots.txt, the sitemap and the social
 * sharing image.
 *
 * Set NEXT_PUBLIC_SITE_URL to the public address in production (e.g.
 * https://money.example.com) so canonical links and share images are absolute.
 */

const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const vercel = process.env.VERCEL_URL?.trim();

export const SITE = {
  description:
    "Track every pound you spend, see who owes who, save for the things you want and plan your savings — with charts, budgets, receipt scanning and an AI money assistant.",
  keywords: [
    "expense tracker",
    "budget app",
    "personal finance",
    "money tracker UK",
    "savings planner",
    "spending tracker",
    "IOU tracker",
    "receipt scanner",
    "wishlist savings",
  ],
  name: "Daily Expenses",
  /** Short headline for titles and share cards. */
  tagline: "Spending, savings and who owes who — in one place",
  themeColor: { dark: "#0c0d1f", light: "#faf9ff" },
  url: (fromEnv || (vercel ? `https://${vercel}` : "http://localhost:3001")).replace(/\/+$/, ""),
} as const;
