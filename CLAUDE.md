# Daily Expenses Tracker

Personal finance app for tracking expenses, managing debt/savings/loans, and visualizing spending.

> **Note:** This project is being merged into `family-space`. See `/Users/usmankhalid/Documents/Personal Projects/family-space/SPEC.md` for the unified project specification. This repo is the reference source for: expenses page, yearly analytics, trackers, CSV/PDF import wizard.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style, neutral base color, CSS variables)
- **Animation**: Motion (motion/react) — used by MagicUI components
- **Charts**: Recharts
- **Tables**: TanStack Table + TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **AI**: Google Gemini (PDF parsing)

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — Run ESLint

## Project Structure

```
src/
├── app/              # Pages & API routes (Next.js App Router)
├── components/
│   ├── ui/           # shadcn/ui + MagicUI primitives (do not edit manually)
│   ├── shared/       # Design-system components: PageHeader, StatCard, Money, Meter, StatusBadge, EmptyState, ErrorState
│   ├── expenses/     # Expense feature components
│   ├── yearly-charts/# Chart components
│   ├── trackers/     # Tracker components
│   ├── layout/       # Navbar (top bar + menus), AccountMenu, AppFooter, CommandPalette
│   └── providers/    # Context & theme providers
├── docs/             # Feature & architecture documentation
├── entities/         # TypeScript data models / types
├── hooks/            # Custom React hooks (organized by feature)
│   ├── expenses/     # useExpenses, useExpenseMutations
│   ├── trackers/     # useTrackers, useTrackersMutations
│   └── yearly-expenses/
└── lib/              # Utilities, config, Supabase client
```

## Code Conventions

### TypeScript

- Strict mode enabled
- Use `@/*` path alias for imports (maps to `./src/*`)
- Define types/interfaces in `src/entities/`

### Imports (enforced by ESLint)

- Sorted via `eslint-plugin-simple-import-sort`
- Order: React/packages → internal `@/` imports → relative imports
- Object keys sorted (warn) via `sort-keys-fix`

### Styling

- Use Tailwind CSS utility classes; combine with `cn()` helper from `@/lib/utils`
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>`
- MagicUI components also land in `src/components/ui/` — add via `npx shadcn@latest add "https://magicui.design/r/<name>"`
- Colors use `oklch()` format; chart/category colors defined in `src/lib/config.ts`
- Currency formatting via `formatCurrency()` from `@/lib/utils`

### Data Fetching & State

- Server state managed with TanStack React Query (hooks in `src/hooks/`)
- Follow existing pattern: `use<Feature>` for queries, `use<Feature>Mutations` for mutations
- Demo mode fallback: app works without Supabase by using hardcoded demo data

### Components

- Feature components organized by domain in `src/components/<feature>/`
- Use shadcn/ui primitives for UI building blocks
- Forms use React Hook Form + Zod schemas

### UI Patterns

- **Skeleton loading**: Use `<Skeleton>` from `@/components/ui/skeleton` in place of spinners — shape the skeleton to match the real layout
- **Empty states**: Use `<EmptyState>` from `@/components/shared/EmptyState` (icon + heading + guidance + action)
- **Design system**: tokens live in `src/app/globals.css` (see `docs/UI_UX_REDESIGN.md`). Use semantic colours (`text-success`, `text-warning`, `text-destructive`, `bg-chart-1…5`) instead of raw palette classes; use `<PageHeader>`, `<StatCard>`, `<Money>`, `<Meter>` (thresholds follow `ALERT_THRESHOLDS`), `<StatusBadge>` and `<ErrorState>` from `@/components/shared/`. The dev-only reference page is `/design-system`
- **Animated numbers**: Use `<NumberTicker>` from `@/components/ui/number-ticker` for currency totals that change on interaction; always put the `$` symbol outside the ticker span
- **MagicCard**: Wrap interactive cards with `<MagicCard>` and set `border-0 shadow-none` on the inner `<Card>` to avoid double borders
- **Navigation**: The top bar (links + Money/Insights dropdowns), mobile menu, footer and the global ⌘K `CommandPalette` all read `NAV_GROUPS` in `src/components/layout/navigation.ts` — add new routes there
- **Profile backend**: Profile/account writes go through `/api/profile/*` route handlers (auth + Zod + same-origin + rate limit), never directly from the browser. Contract in `src/lib/profile/schemas.ts`, server helpers in `src/lib/profile/server.ts`; DB in `supabase/migrations/20261117000000_create_profiles.sql`. See `docs/FEATURE_PROFILE.md`
- **Lend & borrow / Wishlist / Savings**: `/api/ious`, `/api/wishlist`, `/api/money/overview` (shared request plumbing in `src/lib/server/http.ts`); contract + pure maths in `src/lib/money/`. Add dialogs live in `QuickAddProvider` (use `useQuickAdd()`; header "+ New" menu). DB in `supabase/migrations/20261118000000_create_ious_and_wishlist.sql`. See `docs/FEATURE_MONEY.md`
- **AI + Savings plan**: Receipt scan (`/api/receipts/scan`, `src/lib/receipts/`), assistant (`/api/assistant`, `src/lib/assistant/` — AI only parses the question; answers are computed in code), savings plan (`/api/plan/**`, `src/lib/plan/`). See `docs/FEATURE_AI_AND_PLAN.md`
- **Onboarding & engagement**: `EngagementProvider` (`src/components/onboarding/`, mounted in the protected layout) runs the first-run questions (`OnboardingWizard` → `POST /api/onboarding`; state in `user_metadata.onboarding`), the spotlight `ProductTour` (targets `data-tour="…"` attributes — keep them when editing the navbar), daily tips/reminders and budget-alert notifications, and live sync (online/offline, 2-min refresh, cross-tab). Use `useEngagement()` for `startTour`/`openSetup`. Device prefs and "done" flags in `src/lib/onboarding/prefs.ts`; call `markDone(id)` when a user first uses a feature. See `docs/FEATURE_ONBOARDING.md`
- **App shell**: No sidebar. Sticky top bar (`Navbar.tsx`, slides away on scroll down and back on scroll up), page content (max 1440px), `AppFooter`. Logo is the mark only (`LogoMark` in `src/components/brand/Logo.tsx`, also `src/app/icon.svg`); no app name in the UI chrome
- **Theme**: "Indigo & Lime" tokens in `globals.css` — indigo-violet `primary`, lime `highlight` for tiny accents, headings in Plus Jakarta Sans (`--font-display`). Card edges come from the `shadow-md` token (hairline + drop)
- **SEO**: `src/lib/site.ts` (name, description, URL via `NEXT_PUBLIC_SITE_URL`); root metadata + JSON-LD in `src/app/layout.tsx`; `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`; signed-in pages are `noindex`

### General

- Unused vars prefixed with `_` (ESLint configured)
- Prettier with `prettier-plugin-tailwindcss` for class sorting
- Keep config (categories, tags, members, locale) in `src/lib/config.ts`
- See `src/docs/` for feature-level documentation
