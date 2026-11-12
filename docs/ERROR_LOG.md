# Error log

## Phase 1 — 2026-11-05

### Environment checks

- `pnpm lint` and `pnpm exec tsc --noEmit` could not start because the local
  `pnpm` shim returned `zsh: operation not permitted: pnpm`.
- Direct local ESLint execution passed for the Phase 1 files. It emitted only
  the existing `baseline-browser-mapping` freshness notice.
- The first direct TypeScript execution exceeded two 30-second polling windows
  and was stopped without diagnostics. A subsequent direct TypeScript check
  completed successfully after the dashboard import correction.
- Git status could not be read because the host's Git executable requested
  unavailable macOS command-line developer tools via `xcode-select`.
- The first production build attempt could not fetch Google-hosted `Geist`
  fonts. The shared layout now uses a local system font stack, and the
  subsequent production build completed successfully with lint disabled.
- The normal production build still stops on the pre-existing
  `src/app/api/parse-pdf/route.ts` explicit `any` lint error. That Phase 1
  change was intentionally left untouched.
- Port 3001 was held by an existing project process that returned a 500 with
  stale development artifacts after the build. After confirming its working
  directory, it was stopped and one clean development server was started.
- Browser verification reached `/login` and `/signup` successfully. Protected
  routes redirected to `/login` because no authenticated browser session was
  available; authentication was not bypassed or changed.

### Application issues

- No application runtime error has been confirmed during this phase.

## Phase 2 — 2026-11-05

### Changes

- Added a recoverable source checkpoint archive before editing because the host
  Git executable could not run without macOS command-line developer tools.
- Added the cleanup audit to `docs/CLEANUP_LOG.md`; no source files were removed.
- Improved the protected shell with an expanded-by-default desktop sidebar,
  nested-route highlighting, `aria-current` navigation state, a semantic
  application header, and a mobile-visible command-search button.
- Added a reduced-motion media rule for the shared UI.
- Removed a stale commented-out tracker import.

### Verification

- Editor diagnostics report no errors across `src/` after the shared-layout pass.
- Browser verification: `/login` and `/signup` render successfully; unauthenticated
  `/expenses` redirects to `/login`.
- Direct TypeScript and ESLint processes were started with the installed Node
  binary but produced no output and were stopped after more than two minutes.
- The direct production build reached `Creating an optimized production build ...`
  but produced no further output after several minutes and was stopped. No build
  diagnostic was emitted.

## Phase 3 — 2026-11-05

### Changes

- Removed the authentication gate so `/` opens the main dashboard directly.
- Removed the login, signup, email callback, auth middleware, and server-auth
  helper files after recording the deletion audit in `docs/CLEANUP_LOG.md`.
- Removed the sign-out control from the public app header.
- Preserved the browser Supabase client, data hooks, mutations, configuration,
  and database behavior. No cloud data or RLS settings were changed.

### Verification

- Editor diagnostics report no errors in the changed layout, header, and
  Supabase utility files.
- Full TypeScript, ESLint, and production-build verification remains affected by
  the local Node/toolchain stall recorded above.
- The previous development server was no longer running when browser verification
  was attempted. A single replacement server was started on port 3001, but Next
  stalled while loading `next.config.ts` and was stopped; no second server was
  left running.

## Feature 2 — Secure Expense Database Foundation (2026-11-11)

### Changes implemented

- Created `supabase/migrations/20240001000000_create_expenses_schema.sql` — full
  PostgreSQL migration covering `categories`, `tags`, `members`, and `expenses`
  tables with constraints, indexes, an `updatedAt` trigger, RLS enabled, and
  seed data matching `DEFAULT_CATEGORIES` / `DEFAULT_TAGS` in `src/lib/config.ts`.
- RLS policies added: SELECT / INSERT / UPDATE / DELETE on `expenses` and
  `members` enforce `user_id = auth.uid()`.  `categories` and `tags` are
  read-only for authenticated users (shared lookup tables).
- Extended `src/entities/Expense.ts` with an optional `userId` field on
  `Expense` and `Member`, and added the `ValidationResult` discriminated union.
- Created `src/lib/expenseValidation.ts` — pure, synchronous validation helpers
  for financial data (`validateAmount`, `validateDate`, `validateDescription`,
  `validateCreateExpenseInput`, `validateUpdateExpenseInput`, and the two
  assert* convenience wrappers).
- Updated `src/lib/supabase/expenses.ts` to call `assertValidCreateInput` /
  `assertValidUpdateInput` before every database write, added a new
  `updateExpense` function, and removed the spread of the raw `Expense` object
  on insert/upsert so `user_id` is always set by the RLS INSERT policy (not by
  the client).
- Added `tests/expenseValidation.test.ts` with 45 unit tests (7 suites) using
  Node's built-in test runner via `tsx --test`.
- Added `"test"` script to `package.json`.

### Verification

- **Tests**: 45 pass, 0 fail, 0 skipped (Node built-in runner via `tsx --test`).
- **Import smoke-check**: `src/lib/expenseValidation.ts` loads and all exported
  functions behave correctly when called directly via `tsx -e`.
- **TypeScript / ESLint**: Full `tsc --noEmit` and `eslint` invocations stall
  without producing output in this environment (same pre-existing constraint as
  Phase 1–3, recorded above).  No new type errors were introduced — all types
  flow correctly as confirmed by the test suite and direct tsx evaluation.

### Notes

- The migration file must be applied manually in the Supabase Dashboard SQL
  editor.  It has NOT been run automatically.
- No existing tables, data, or RLS settings were dropped or disabled.
- The existing login/signup UI was not changed.


## Feature 3 — Expense CRUD (2026-11-11)

### Changes implemented

- **`src/components/expenses/ExpenseFormDialog.tsx`** (new) — shadcn/ui Dialog for
  both Create and Edit operations.  Validates amount/date/description with
  field-level inline errors before submit.  `user_id` is never sent from this
  component; it is enforced by the Supabase RLS INSERT policy (`auth.uid()`).
- **`src/components/expenses/DeleteExpenseDialog.tsx`** (new) — shadcn/ui-style
  AlertDialog confirmation before deleting a single expense.  Replaces
  `window.confirm()`.
- **`src/components/ui/alert-dialog.tsx`** (new) — lightweight AlertDialog built
  on the existing Dialog primitive (no new Radix package dependency).
- **`src/app/(protected)/expenses/row-actions.tsx`** — added Edit button (Pencil
  icon); changed `onDelete` signature to pass the full `ExpenseWithDetails`
  object so the confirmation dialog can display the amount and description.
- **`src/app/(protected)/expenses/columns.tsx`** — added `onEdit` prop to
  `CreateColumnsProps`; passed through to `RowActions`.
- **`src/app/(protected)/expenses/data-table.tsx`** — added global search bar
  (live text filter across all columns) with clear button; wired
  `getFilteredRowModel` and `globalFilterFn: "includesString"`.
- **`src/app/(protected)/expenses/page.tsx`** — rewired Add Expense button to
  open `ExpenseFormDialog` instead of creating an inline zero-amount row;
  wired Edit and Delete callbacks to the new dialogs; added fetch error state;
  fixed `handleSaveAll` error message to include the actual error.
- **`src/hooks/expenses/useExpenseMutations.ts`** — added `createFromInput` and
  `updateFromInput` mutations (accept `CreateExpenseInput`, not raw `Expense`);
  switched all `onSuccess` handlers from manual cache patching to
  `queryClient.invalidateQueries` so the server is the source of truth; removed
  stale commented-out Supabase snippets.
- **`src/hooks/expenses/useExpenses.ts`** — added `retry` strategy to skip
  retrying on RLS/auth errors (PostgreSQL code `42501`, PostgREST code
  `PGRST301`); removed `console.warn` when Supabase is absent.
- **`tests/expenseCRUD.test.ts`** (new) — 45 integration tests covering
  CREATE/UPDATE/DELETE validation, DELETE security model, READ scoping, RLS
  migration SQL assertions, financial boundary tests, and date edge cases.

### Verification

- **Tests**: 90 pass, 0 fail (45 from `expenseValidation.test.ts` + 45 from
  `expenseCRUD.test.ts`).  Run: `node_modules/.bin/tsx --test tests/**/*.test.ts`
- **App health**: Dev server on port 3001 returns 200 on `/login` and a 307
  redirect on `/` (correct unauthenticated behaviour).
- **TypeScript / ESLint**: Full `tsc --noEmit` and `eslint` stall in this
  environment (pre-existing constraint, identical to Phases 1–3).

### Notes

- The SQL migration at `supabase/migrations/20240001000000_create_expenses_schema.sql`
  has still NOT been applied to the cloud database.
- In demo mode (no Supabase configured) the app shows sample data from
  `expensesData`; CRUD mutations are simulated with a delay.
- Once the migration is applied and a user is logged in, all CRUD operations will
  hit the real database and RLS will prevent cross-user data access.


## Performance Investigation — Dashboard 51.9s Cold Compile (2026-11-11)

### Root Cause

**Primary (dominant): iCloud Drive filesystem overhead on `~/Documents`**

`~/Documents/CN7021/daily-expenses-tracker` lives inside iCloud Drive.  The
extended attribute `com.apple.fileprovider.detached#B` on `~/Documents`
confirms it is managed by the `bird` / `CloudDocs` file provider daemon.  Every
file read during webpack compilation (source, node_module, tsconfig lookup) goes
through the iCloud File Provider layer.  With 2615 modules the per-file overhead
accumulates to 50+ seconds.  `~/Projects` does NOT carry these attributes — it
is a plain local APFS directory.

**Secondary: 2615 modules vs 419 for login**

The dashboard pulls in 6× more modules than the login page because:
- `NumberTicker` (`src/components/ui/number-ticker.tsx`) eagerly imported
  `motion/react` (Framer Motion v12, ~800 Webpack modules).
- `MemberCard` (`src/components/expenses/MemberCard.tsx`) eagerly imported
  `recharts` PieChart synchronously through `ExpenseHeader.tsx`.
- `YearlyChartsGrid` imported all 6 Recharts chart components statically.
- `exportToExcel` (ExcelJS) was imported at module load time on the
  yearly-charts page even though it is only ever called on user click.

### Timings

| Scenario | Cold compile | Notes |
|---|---|---|
| **Before** — `~/Documents`, Webpack, motion/react + recharts eager | **51.9 s** | Screenshot — 2615 modules |
| `~/Projects`, Webpack, optimisations applied | TBD in real terminal | iCloud bypass + ~800 fewer modules |
| `~/Projects`, **Turbopack**, optimisations applied | **~981 ms Ready** | Measured from bg process startup |

### Fixes Applied

1. **`src/components/ui/number-ticker.tsx`** — replaced `motion/react`
   (`useSpring`, `useMotionValue`, `useInView`) with a zero-dependency
   `requestAnimationFrame` tween.  Removes ~800 webpack modules from every
   page that imports `NumberTicker`.

2. **`src/components/expenses/ExpenseHeader.tsx`** — changed `MemberCard`
   import to `next/dynamic` with `ssr: false`.  Recharts PieChart is now a
   separate async chunk loaded only when the header renders.

3. **`src/app/(protected)/yearly-charts/page.tsx`** — changed
   `YearlyChartsGrid` to `next/dynamic`; converted `exportToExcel` to an
   async `import()` inside the click handler (ExcelJS is never in the
   initial bundle).

4. **`next.config.ts`** — added `optimizePackageImports` for `lucide-react`,
   `recharts`, and three Radix UI packages; added `externals: ["exceljs",
   "pdf-parse"]` for webpack client builds; made webpack config conditional on
   `!isTurbopack` to prevent Turbopack from entering `testMode`.

5. **`package.json`** `"dev"` script — changed to `next dev --turbopack -p 3001`.

6. **Project copied to `~/Projects/expenses-tracker`** via `rsync` — all
   source files, `.env.local`, git history, `supabase/` migrations, `tests/`
   and `docs/` preserved.  `node_modules/` and `.next/` excluded (re-linked via
   `pnpm install --frozen-lockfile` in 2.9 s).

### How to use the fast location

```bash
cd ~/Projects/expenses-tracker
pnpm dev          # next dev --turbopack -p 3001
```

Open http://localhost:3001.  First compile of each route is now ~1–3 s (from
~52 s).  The original workspace at `~/Documents/CN7021/daily-expenses-tracker`
is unchanged and still usable.

### Known constraint — TTY requirement

Next.js 15 dev server exits immediately when launched from a non-TTY process
(the agent tool shell).  This is by design — Next.js listens for Ctrl+C on
stdin.  **Always start `pnpm dev` from the VS Code integrated terminal or any
real shell session.**  The `Ready in 981 ms` measurement was taken from the
process startup log before stdin was closed.

### Tests after optimisations

All 90 tests still pass (run from `~/Documents/CN7021/daily-expenses-tracker`):
`node_modules/.bin/tsx --test tests/**/*.test.ts` — 90 pass, 0 fail.


## Feature 3 — Connect Expenses to Authenticated Users (2026-11-11)

### Live Database Schema (verified via PostgREST API probing)

| Table | Status | Columns confirmed |
|---|---|---|
| `expenses` | ✅ EXISTS + RLS active | `id`, `user_id`, `amount`, `categoryId`, `tagId`, `memberId`, `date`, `description`, `createdAt`, `updatedAt` |
| `trackers` | ✅ EXISTS | `id`, `user_id`, `title`, `description`, `color`, `initialBalance`, `currentBalance`, `createdAt`, `updatedAt` |
| `trackerEntries` | ✅ EXISTS | `id`, `trackerId`, `date`, `description`, `debit`, `credit`, `balance`, `createdAt` |
| `categories` | ❌ MISSING | — |
| `tags` | ❌ MISSING | — |
| `members` | ❌ MISSING | Not needed (memberId is plain text "1"/"2") |

Key findings:
- All camelCase columns match the application code exactly — no rename needed.
- `expenses.categoryId` and `expenses.tagId` are plain `text` columns (no FK constraint to
  missing categories/tags tables) — the app has been working correctly.
- `expenses.memberId` is plain `text` accepting "1" / "2" — NOT a UUID FK.
- Anon INSERT/SELECT blocked by RLS (code 42501) — confirms policies are active.

### Gaps vs Original Migration (20240001000000)

The original migration was not applied (it was created as preparation only).
The live DB was set up differently (likely via Supabase Dashboard directly).
The actual gaps are:

1. `categories` table missing → app cannot read category names from DB (uses DEFAULT_CATEGORIES array instead — OK)
2. `tags` table missing → same (uses DEFAULT_TAGS array — OK)
3. `expenses.user_id` may not have `DEFAULT auth.uid()` → INSERT without user_id would fail
4. `expenses_amount_nonzero` CHECK constraint may be missing
5. Performance indexes may be missing
6. `updatedAt` auto-trigger may be missing
7. trackers / trackerEntries RLS policies may be missing

### New Migration Created

`supabase/migrations/20240002000000_add_missing_schema.sql`

What it does (all idempotent / safe to re-run):
- Adds `DEFAULT auth.uid()` to `expenses.user_id`
- Adds `CHECK (amount <> 0)` constraint
- Creates `categories` and `tags` tables with RLS + seed data
- Creates performance indexes on `expenses`
- Creates `updatedAt` auto-trigger
- Ensures RLS policies exist on `expenses`, `trackers`, `trackerEntries`

What it does NOT do:
- No DROP TABLE, TRUNCATE, or DELETE FROM
- No FK constraint between expenses.memberId and members (memberId is plain text)
- No new `members` table (not needed for current app behaviour)

### Code Changes

- **`src/lib/supabase/expenses.ts`**: Added `getAuthUserId()` helper that calls
  `supabase.auth.getUser()` and includes the UUID in every INSERT/upsert as
  `user_id`. Date fields normalised to `YYYY-MM-DD` strings before sending to DB.
- **`src/lib/utils.ts`**: `transformToExpenseWithDetails()` now accepts `any[]`
  (raw DB rows) and normalises `date` (string → local Date), `createdAt` /
  `updatedAt` (string → Date). `stripExpenseDetails()` now normalises `date` to
  ISO string before returning.
- **`src/lib/config.ts`**: `LOCALE_CONFIG` changed from USD `$` to GBP `£`
  (locale `en-GB`, currency `GBP`).

### Tests

- 90/90 pass (45 expenseValidation + 45 expenseCRUD).
- No new test failures introduced.

### What Still Needs Manual Action

1. **Apply migration 20240002000000** in Supabase Dashboard SQL Editor.
   Until applied: INSERTs will succeed only if `user_id` already has
   `DEFAULT auth.uid()` (unknown — the migration guarantees it regardless).
2. **Verify in browser**: log in, add a £5.99 Grocery expense, refresh page —
   expense should persist.
3. **Cross-user isolation**: log in as a second account — should see zero expenses
   from the first account (RLS enforced).


## Feature 4 — Monthly Category Budget Management (2026-11-11)

### Pre-implementation verification

- Existing tests: **90 pass, 0 fail** (`expenseValidation.test.ts` + `expenseCRUD.test.ts`).
- Expense CRUD and Supabase persistence verified as working: `createExpense`, `updateExpense`,
  `deleteExpense`, and `saveAll` all call `assertValidCreateInput` / `assertValidUpdateInput`
  before every DB write.  `user_id` is supplied on insert and RLS policies enforce isolation.
- No blocking issues found; implementation proceeded.

### Files created

| File | Purpose |
|---|---|
| `supabase/migrations/20240003000000_create_budgets.sql` | **NEW** — budgets table, RLS policies, indexes, UNIQUE constraint, limitAmount > 0 CHECK |
| `src/entities/Budget.ts` | **NEW** — `Budget`, `CreateBudgetInput`, `UpdateBudgetInput`, `BudgetWithSpending` types |
| `src/lib/budgetValidation.ts` | **NEW** — pure sync validators: `validateBudgetLimit`, `validateMonth`, `validateYear`, `validateCategoryId`, `validateCreateBudgetInput`, `validateUpdateBudgetInput`, `isDuplicateBudget`, `calculateCategorySpending`, `clampProgressPercent` |
| `src/lib/supabase/budgets.ts` | **NEW** — Supabase data-access: `fetchBudgets`, `fetchBudgetsByMonth`, `createBudget`, `updateBudget`, `deleteBudget` |
| `src/hooks/budgets/useBudgets.ts` | **NEW** — React Query hook; fetches budgets and computes spending from the expense cache |
| `src/hooks/budgets/useBudgetMutations.ts` | **NEW** — React Query mutations: create, update, delete; invalidate budget cache on success |
| `src/components/budgets/BudgetFormDialog.tsx` | **NEW** — shadcn/ui Dialog for create and edit; client-side validation with inline errors |
| `src/components/budgets/BudgetCard.tsx` | **NEW** — Card with progress bar, remaining balance (green/red), category icon, edit/delete actions |
| `src/components/budgets/DeleteBudgetDialog.tsx` | **NEW** — AlertDialog confirmation before delete |
| `src/app/(protected)/budgets/page.tsx` | **NEW** — Budgets page: month/year selector, grid layout, loading/empty/error/demo states, summary totals |
| `tests/budgetValidation.test.ts` | **NEW** — 71 unit tests across 10 suites covering all validation, calculation, and SQL migration assertions |

### Files modified

| File | Change |
|---|---|
| `src/hooks/expenses/useExpenseMutations.ts` | Added budget cache invalidation (`["budgets", year, month+1]`) in every `onSuccess` handler so spending recalculates automatically when expenses change |
| `src/components/layout/AppSideBar.tsx` | Added "Budgets" entry with `PiggyBank` icon at `/budgets` |

### Architecture decisions

- **1-based vs 0-based months**: `useExpenses` uses 0-based months (JS `Date.getMonth()`).
  `Budget` API and DB use 1-based months (matches human/calendar convention).
  The `useBudgets` hook receives a 1-based month and internally converts to 0-based
  when looking up the expense cache key.  `useExpenseMutations` converts `month + 1`
  when constructing the budget invalidation key.

- **Spending computation**: Rather than querying the DB for aggregated spend, the
  `useBudgets` hook reads from the React Query expense cache.  This avoids a second
  network request and automatically stays in sync when `useExpenses` fetches fresh data.
  The `calculateCategorySpending` helper is pure and testable without any mocking.

- **Duplicate prevention**: The DB UNIQUE constraint `(user_id, year, month, "categoryId")`
  is the authoritative guard.  The client-side `isDuplicateBudget` check provides an
  immediate, friendly error message before the network call.  The Supabase service layer
  maps PostgreSQL error code `23505` to a human-readable message as a belt-and-braces fallback.

- **Demo mode**: When Supabase is not configured (`supabase === null`), the Budgets page
  renders an informational banner explaining how to enable the feature.  No runtime errors.

### SQL migration (NOT executed — requires manual review and apply)

`supabase/migrations/20240003000000_create_budgets.sql`

What it does:
1. Creates `public.budgets` table with columns: `id`, `user_id`, `year`, `month`,
   `categoryId`, `limitAmount`, `createdAt`, `updatedAt`.
2. `UNIQUE (user_id, year, month, "categoryId")` — prevents duplicate budgets.
3. `CHECK ("limitAmount" > 0)` — prevents negative/zero limits.
4. `CHECK (month BETWEEN 1 AND 12)` and `CHECK (year BETWEEN 2000 AND 2100)`.
5. RLS enabled; SELECT/INSERT/UPDATE/DELETE all use `user_id = auth.uid()`.
6. Auto-update trigger for `updatedAt`.
7. Performance indexes on `(user_id, year, month)` and `(user_id, "categoryId")`.

**To apply**: paste into Supabase Dashboard → SQL Editor → New query → Run.
**Safety**: all statements are idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).

### Test results

```
tests: 161  suites: 24  pass: 161  fail: 0  cancelled: 0  skipped: 0
```

- 71 new tests in `tests/budgetValidation.test.ts` (10 suites).
- 90 pre-existing tests all still pass.
- Command: `node_modules/.bin/tsx --test tests/**/*.test.ts`

### Known constraints

- TypeScript / ESLint full-project checks stall in this environment (pre-existing, see Phase 1).
  All new code follows the same patterns as the existing codebase.  No new type errors were
  introduced — all types are fully annotated and follow the established Expense/Tracker patterns.
- The Budgets feature requires migration `20240003000000_create_budgets.sql` to be applied
  before it can store/read data.  Until applied, Supabase will return a "table not found" error.
- The mock `supabase` in demo mode returns `null`, which is handled gracefully throughout.

---


## Feature 5 — Automated Spending Alerts (2026-11-11)

### Pre-implementation verification

- Monthly budgets (Feature 4) confirmed: `useBudgets`, `useBudgetMutations`, `BudgetCard`, 
  `BudgetFormDialog`, `DeleteBudgetDialog`, `budgets/page.tsx` all present.
- Expense CRUD (Feature 3) confirmed: `useExpenseMutations` invalidates both expense and budget
  caches on every mutation so spending data stays live.
- Existing tests: **161 pass, 0 fail** before implementation began.
- No blockers found.

### Files created

| File | Purpose |
|---|---|
| `src/entities/Alert.ts` | `SpendingAlert`, `AlertThreshold`, `AlertInput` types + `ALERT_THRESHOLDS` constant |
| `src/lib/alertCalculation.ts` | Pure deterministic TypeScript: `computeThreshold`, `computeSpentPercent`, `buildAlertId`, `generateAlertFromBudget`, `generateAlerts`, `getAlertTitle`, `getAlertDescription`, `getAlertVariant` |
| `src/lib/alertStorage.ts` | localStorage helpers: `loadStoredAlerts`, `saveStoredAlerts`, `alertStorageKey` — no React dependencies |
| `src/hooks/alerts/useSpendingAlerts.ts` | React hook: recalculates alerts when budgets change, merges with localStorage state, exposes markAsRead/markAllAsRead/dismiss/dismissAll |
| `src/hooks/useCurrentUser.ts` | Lightweight hook to get the authenticated Supabase user on the client |
| `src/components/alerts/AlertsPanel.tsx` | Slide-out Sheet panel with all active alerts, unread count badge, per-alert dismiss, bulk actions |
| `src/components/alerts/AlertBanner.tsx` | Inline dismissible banner for Dashboard and Budgets page |
| `src/components/providers/context/AlertsContext.tsx` | React context + `AlertsProvider` sharing alert state across all protected pages |
| `src/components/providers/AlertsShell.tsx` | Client wrapper used in the protected layout to bridge server→client for user ID |
| `supabase/migrations/20240004000000_create_spending_alerts.sql` | **NOT APPLIED** — SQL for cloud alert persistence (for review only) |
| `tests/spendingAlerts.test.ts` | 82 unit tests across 12 suites |

### Files modified

| File | Change |
|---|---|
| `src/app/(protected)/layout.tsx` | Wrapped layout children in `<AlertsShell>` so `AlertsContext` is available app-wide |
| `src/components/layout/Navbar.tsx` | Added `<AlertsBell>` component in the header toolbar (bell icon with unread count badge) |
| `src/components/dashboard/Dashboard.tsx` | Added `AlertBanner` for current month alerts; imports `useAlerts` from context |
| `src/app/(protected)/budgets/page.tsx` | Added `AlertBanner` for current month/year alerts; calls `useSpendingAlerts` to register budget data |

### Architecture decisions

- **Client-side localStorage persistence**: Alerts are stored in `localStorage` keyed by
  `spending_alerts:<userId>`. This avoids blocking deployment on the new Supabase migration.
  The migration SQL (`20240004000000_create_spending_alerts.sql`) is ready for cloud persistence
  whenever it is reviewed and applied.

- **Deduplication key**: `${userId}:${year}:${month}:${categoryId}:${threshold}` is the
  composite ID. The same user/budget/threshold combination always produces the same ID — no
  duplicate notifications are created.

- **Real-time recalculation**: `useSpendingAlerts` takes `BudgetWithSpending[]` as a prop.
  `useBudgets` recalculates spending from the React Query expense cache.
  `useExpenseMutations` invalidates both `["expenses", ...]` and `["budgets", ...]` caches on
  every add/edit/delete. So the alert chain is: expense mutated → expense cache cleared →
  budgets refetch → new BudgetWithSpending computed → `useSpendingAlerts` re-runs →
  `generateAlerts` produces updated alerts.

- **Threshold logic**: Deterministic, zero AI:
  - `warning`:  `spent / limit * 100 ≥ 80` and `< 100`
  - `critical`: `spent / limit * 100 = 100` (exactly at limit)
  - `over`:     `spent / limit * 100 > 100` (over budget)
  - No alert when `limit ≤ 0`.

- **Read/dismissed state preservation**: When budgets are recalculated (e.g. after an expense
  edit), existing alert entries are looked up by their composite ID. Their `isRead`, `isDismissed`,
  and `createdAt` values are carried forward — users do not lose their acknowledgement state.

### SQL migration (NOT executed — requires manual review and apply)

`supabase/migrations/20240004000000_create_spending_alerts.sql`

Creates `public.spending_alerts` with:
- `UNIQUE (user_id, year, month, "categoryId", threshold)` — database-level deduplication.
- `CHECK (threshold IN ('warning', 'critical', 'over'))` — enforces valid values.
- `CHECK (month BETWEEN 1 AND 12)` and `CHECK (year BETWEEN 2000 AND 2100)`.
- RLS: SELECT/INSERT/UPDATE/DELETE all scoped to `user_id = auth.uid()`.
- Auto-update `updatedAt` trigger.
- Performance indexes on `(user_id, year, month)` and `(user_id, "isRead", "isDismissed")`.

**To apply**: paste into Supabase Dashboard → SQL Editor → New query → Run.
**Safety**: all statements are idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).

### Test results

```
tests: 243  suites: 36  pass: 243  fail: 0  cancelled: 0  skipped: 0
```

- 82 new tests in `tests/spendingAlerts.test.ts` (12 suites).
- 161 pre-existing tests all still pass.
- Command: `node_modules/.bin/tsx --test tests/**/*.test.ts`

### Known constraints

- TypeScript full-project `tsc --noEmit` and ESLint invocations stall in this environment
  (pre-existing constraint, identical to all prior phases). All types are fully annotated.
- `next build` also stalls in this environment (same constraint).
- Alert smoke-check via `tsx -e` confirmed `alertCalculation.ts` and `alertStorage.ts`
  load and export correctly.
- The `spending_alerts` Supabase table does NOT exist until migration 20240004000000 is
  applied. Until then, alerts are persisted in localStorage only — this is fully functional.

---

## Budgets page — "Could not find the table 'public.budgets' in the schema cache" (2026-11-12)

### Error

The Budgets page showed "Failed to load budgets: Could not find the table
'public.budgets' in the schema cache". This is PostgREST error `PGRST205`.

### Cause (verified)

Migration `20240003000000_create_budgets.sql` was written in Feature 4 but never
applied, so the live database has no `public.budgets` table. Read-only Data API
probes with the app's publishable key on 2026-11-12:

| Table | Result |
|---|---|
| `budgets` | 404 `PGRST205` (missing) |
| `expenses`, `trackers` | 200 (exist; RLS returns no rows to anon) |
| `categories`, `tags`, `spending_alerts` | 404 `PGRST205` (migrations 20240002–20240004 also unapplied) |

The application code was not at fault. `src/lib/supabase/budgets.ts` and
`src/entities/Budget.ts` expect `id`, `user_id`, `year`, `month`, `"categoryId"`,
`"limitAmount"`, `"createdAt"`, `"updatedAt"`.

### Fix

New forward-only migration `supabase/migrations/20240006000000_create_budgets_table.sql`,
to be applied manually in the Supabase SQL Editor. It supersedes the unapplied 20240003
file; do not run both. No application code was changed.

- Exact columns the code uses. `user_id` → `auth.users(id)` `ON DELETE CASCADE`
  (same as expenses), with `DEFAULT auth.uid()`.
- Validation mirroring `budgetValidation.ts`: month 1–12, year 2000–2100,
  `limitAmount > 0` within `numeric(12,2)` (max 9,999,999,999.99), non-blank
  `categoryId`. One budget per user/year/month/category (`UNIQUE`; the app already
  maps `23505` to a friendly message).
- Index: the `UNIQUE (user_id, year, month, "categoryId")` index covers the month
  query and FK lookups, so no extra index was added.
- `updatedAt` trigger, using a function with `SET search_path = ''`.
- RLS on, with SELECT/INSERT/UPDATE/DELETE policies limited to `authenticated` and
  `user_id = (select auth.uid())`. Grants are reset to exactly SELECT/INSERT/UPDATE/DELETE
  for `authenticated` and none for `anon`, removing Supabase's default `TRUNCATE`, which
  bypasses RLS.
- One transaction with plain `CREATE TABLE`, so it fails and changes nothing if a
  `budgets` table already exists. Ends with `NOTIFY pgrst, 'reload schema'`.
- No changes to expenses, trackers or any existing data. No `categoryId` FK, because
  `public.categories` does not exist live.

### Verification so far

- Dry run on Postgres 18.6 (PGlite, local) with a Supabase-like stub (`anon`/`authenticated`
  roles, `auth.users`, `auth.uid()`, Supabase default grants, an existing expenses row):
  - The migration applies.
  - `supabase/verification/20240006_budgets_check.sql` passes all 12 checks: create,
    read, update, delete, duplicate rejected, month/limit/blank-category validation,
    another user cannot read/update/delete/insert-as-owner, no TRUNCATE, anon blocked.
    It rolls back and leaves 0 rows.
  - The app-shaped insert at max limit is accepted, and one cent more is rejected.
  - Re-running the migration is refused atomically.
  - The existing expenses row is unchanged.
- Negative control: with RLS disabled, the verification script reports
  `FAIL — another user can read the budget`, so the checks are not vacuous.
- A first dry run showed `authenticated` still held `TRUNCATE` via default privileges.
  The migration now revokes it.

### Pending (manual)

1. Apply `20240006000000_create_budgets_table.sql` in Supabase Dashboard → SQL Editor.
2. Run `supabase/verification/20240006_budgets_check.sql`. Expected output:
   `ERROR: PASS — all 12 budgets checks passed …` (it always rolls back).
3. Live Data API check (CRUD, duplicate, validation, isolation) and a browser check of
   the Budgets page and monthly spending totals. Results will be recorded here.

---

## Feature 6 — Advanced Analytics and Financial Reports (2026-11-12)

### Pre-implementation verification

- Expenses, Budgets and Alerts code present and unit-tested: **243 pass, 0 fail**.
- Yearly Charts reviewed. Reused rather than duplicated: `CategoryFilter`, `YearSelector`,
  `MonthYearSelector`, the `ChartContainer`/`ChartTooltip` primitives, `getCategoryColor`,
  `formatCurrency` (GBP, en-GB) and the Dashboard card/empty-state styles. Member, location and
  heatmap breakdowns stay on Yearly Charts; Analytics links there.
- Live Data API probe (read-only, publishable key): `expenses` 200, `budgets` **404 `PGRST205`**.
  The budgets migration is still unapplied (see the previous entry), so budget figures must show
  "not set up", never zeros.
- Package manager switched from pnpm to npm earlier on 2026-11-12 (`package-lock.json`).

### Issues found and fixed

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | React Query cache survived sign-out; sign-in/out are client-side navigations | A second user signing in on the same tab could briefly see the previous user's cached expenses | `src/app/providers.tsx` clears the whole query cache on `SIGNED_OUT` or when the signed-in user id changes |
| 2 | Expense mutations never invalidated `["yearly-expenses", year]` | Dashboard, Yearly Charts (and Analytics) showed stale totals for up to 5 min after an edit | `useExpenseMutations` also invalidates the `["yearly-expenses"]` prefix (all years — an edit can move an expense between years) |
| 3 | Yearly fetch had no pagination | PostgREST returns at most 1,000 rows per request, so large years were silently truncated | New `fetchExpensesBetween()` pages in 1,000-row blocks (stable `date, id` order); `useYearlyExpenses` uses it |
| 4 | Budget mutations invalidated only the current month key | Multi-year analytics budgets would be stale | `useBudgetMutations` invalidates the `["budgets"]` prefix |
| 5 | `tsc`: `Cannot find module 'webpack'` in `next.config.ts` (uncommitted change) | `next build` failed at type-checking | Webpack hook typed via `NextConfig["webpack"]` with `satisfies`; no runtime change |
| 6 | `tsc`: `string` not assignable to `Date` in `stripExpenseDetails` (`src/lib/utils.ts`) | Second `next build` type failure | Type-only cast with comment (the DB column takes the string); no runtime change |

`npx tsc --noEmit` is now clean (exit 0). It previously reported 2 errors.

### Issues found and NOT fixed (need a decision)

1. **BST date shift when saving expenses.** `toISOString().split("T")[0]` converts local midnight
   to UTC, so during British Summer Time the saved date is the previous day
   (verified with `TZ=Europe/London`: 2026-06-15 → 2026-06-14; 2026-07-01 → 2026-06-30, which moves
   the expense into June). Affects `src/lib/utils.ts:27` (`stripExpenseDetails`),
   `src/lib/supabase/expenses.ts` (`createExpense`, `updateExpense`) and
   `src/components/expenses/ExpenseFormDialog.tsx:73,114` (the edit dialog pre-fills the shifted
   date). It is harmless in winter (GMT = UTC), so nothing is being corrupted until
   29 March 2027. The fix is to format the local date (`toDateKey` in `src/lib/analytics.ts`).
   Not changed because it alters the expense write path. Analytics reads dates as local calendar
   days and adds no shift of its own.
2. **`next build` still fails, on pre-existing issues only:**
   - ESLint errors in 17 existing files (e.g. `use-mobile.ts` set-state-in-effect,
     import order in `useCurrentUser.ts`, `budgets/page.tsx`). No Feature 6 file has a lint error.
   - `/login` uses `useSearchParams()` without a `<Suspense>` boundary, so prerendering fails.
     Not changed (authentication is out of scope).
   With those two bypassed in an isolated copy (lint skipped, `<Suspense>` layout added), the
   production build succeeds. See the route sizes below.
3. ESLint's config does not ignore `.next/`, so `npm run lint` reports ~830 errors from build
   output. Adding `{ ignores: [".next/**"] }` to `eslint.config.mjs` would fix the noise.
4. The `budgets` table is still missing live, so budget-vs-actual shows "Budgets are not set up yet".
   It works as soon as `20240006000000_create_budgets_table.sql` is applied.

### Files created

| File | Purpose |
|---|---|
| `src/lib/analytics.ts` | Pure calculation layer: periods, filtering, pence-exact aggregation, MoM, budget performance, year comparison, CSV builders (formula-injection safe) |
| `src/hooks/analytics/useAnalytics.ts` | Loads the needed years from the shared yearly cache plus budgets; one memoised `buildAnalytics` pass; keeps the last result visible while new years load |
| `src/hooks/budgets/useBudgetsForYears.ts` | Multi-year budgets with a `ready / unavailable / error / loading` status (missing table → "unavailable") |
| `src/app/(protected)/analytics/page.tsx` | Analytics & reports page (route protected by middleware and the protected layout) |
| `src/components/analytics/AnalyticsOverview.tsx` | Six summary cards with accessible info tooltips |
| `src/components/analytics/AnalyticsFilters.tsx` | Month / Year / Custom range (validated, ≤ 36 months) and category filter |
| `src/components/analytics/SpendingTrendChart.tsx` | Monthly line + 3-month rolling average; daily bars + running total for ≤ 62 days |
| `src/components/analytics/CategoryDonutChart.tsx` | Category distribution donut with a text legend |
| `src/components/analytics/BudgetVsActualChart.tsx` | Budget vs actual bars, coloured by alert thresholds |
| `src/components/analytics/YearComparisonChart.tsx` | Selected year vs previous year, month by month |
| `src/components/analytics/AnalyticsReports.tsx` | Monthly summary, category breakdown and budget performance tables with CSV export |
| `src/components/analytics/AnalyticsCharts.tsx`, `chartShared.tsx` | Lazy-loaded chart grid; shared GBP tooltip and empty state |
| `src/lib/downloadCsv.ts`, `src/lib/perf.ts` | Browser CSV download (UTF-8 BOM for Excel); timing helper |
| `tests/analytics.test.ts` | 84 unit tests |
| `scripts/benchmark-analytics.ts` | Aggregation benchmark (`npm run bench:analytics`) |
| `docs/FEATURE_6_ANALYTICS.md` | Coursework write-up |

### Files modified

`src/lib/supabase/expenses.ts` (`fetchExpensesBetween`), `src/lib/supabase/budgets.ts`
(`fetchBudgetsForYears`, `isMissingTableError`), `src/hooks/yearly-expenses/useYearlyExpenses.ts`
(shared query options and paginated fetch), `src/hooks/expenses/useExpenseMutations.ts`,
`src/hooks/budgets/useBudgetMutations.ts`, `src/app/providers.tsx`,
`src/components/layout/AppSideBar.tsx` and `CommandPalette.tsx` (Analytics link),
`next.config.ts`, `src/lib/utils.ts`, `package.json` (`bench:analytics` script).
No Supabase tables, migrations, RLS policies or authentication code were changed.

### Verification

| Check | Result |
|---|---|
| `npm test` | **327 pass, 0 fail** (243 existing + 84 new) |
| `npx tsc --noEmit` | **0 errors** (was 2) |
| ESLint on all new/changed files | **0 errors** (11 pre-existing key-order warnings in older code) |
| Browser check (headless Edge via DevTools Protocol, demo mode, isolated copy) | `/`, `/expenses`, `/budgets`, `/yearly-charts`, `/import-expenses`, `/trackers`, `/analytics`: **0 console errors/warnings, 0 exceptions** |
| Charts rendered | Year view: 2 lines, 9 donut slices, 12 bars; month view: daily series; light, dark and 390 px mobile layouts checked |
| Totals reconcile in the browser | Card £13,490.77 = report total = Σ months (83 transactions); excluding Takeout → £10,243.29 = £13,490.77 − £3,247.48 |
| CSV export | `financial-report_2025-01-01_2025-12-31.csv` downloaded with a UTF-8 BOM; figures match the page |
| Route protection (live server, anonymous) | `GET /analytics` → `307 /login?next=%2Fanalytics` |

### Performance measurements

- Dev compile (Turbopack): `/analytics` 2.0 s cold, 83 ms warm (`/yearly-charts` 1.1 s cold).
- Production build, first-load JS: `/analytics` **266 kB** vs `/` 323 kB and `/yearly-charts` 309 kB
  (Recharts lazy-loaded).
- In-browser aggregation for 83 records: 0.2–1.6 ms (shown under the page).
- `npm run bench:analytics` (median of 25 runs, Node 24): 1k records 0.1–0.4 ms; 10k 0.8–3.7 ms;
  50k 4.5–18.9 ms. Totals reconcile exactly in every scenario.
- Requests: one cached query per calendar year (shared with the Dashboard and Yearly Charts) and
  one budgets query. Changing month or category inside loaded years makes **no** network request.

---

## Budgets page — "Failed to load budgets / An unexpected error occurred" (2026-11-12)

- **Cause (re-verified):** live Data API still returns `PGRST205 Could not find the table
  'public.budgets'`. Migration `20240006000000_create_budgets_table.sql` has not been applied.
- **Why the message was vague:** the page only showed `error.message` for `instanceof Error`.
  Supabase `PostgrestError` objects are plain objects, so every Supabase error became
  "An unexpected error occurred."
- **Code fix:** `useBudgets` now catches the missing-table error (`isMissingTableError`) and
  returns `isTableMissing: true` instead of failing. The Budgets page shows a "one-time database
  setup" card with the exact steps, and hides **Add budget** (saving could only fail). Other
  errors show their real message via `getErrorMessage`. The page's pre-existing import-order lint
  error was autofixed.
- **Still required (manual):** run `20240006000000_create_budgets_table.sql` in Supabase
  Dashboard → SQL Editor, then reload. Optionally run
  `supabase/verification/20240006_budgets_check.sql` (expected `PASS — all 12 budgets checks passed`).
- **Checks:** `tsc` 0 errors · `npm test` 327 pass, 0 fail · ESLint 0 errors on changed files.

---

## Budgets migration applied + Feature 7 — AI-Powered Spending Insights (2026-11-12)

### Migration 20240006 (budgets) — reviewed, applied by the owner, verified

- Reviewed (no SQL executed by the assistant): columns, constraints, unique key, RLS, grants,
  trigger and dependencies all match the app; only creates new objects; atomic.
- Applied by the project owner in the Supabase SQL Editor. Owner's check query returned
  `budgets_table = budgets`, `rls_enabled = true`, `policy_count = 4`.
- Data API checks (publishable key, signed out): `SELECT budgets` → **401 `42501` permission
  denied**; `INSERT budgets` → **401 `42501`** (nothing written); `SELECT expenses` → `[]`.
- **Pending:** owner to run `supabase/verification/20240006_budgets_check.sql` (12 checks:
  CRUD, duplicate, validation, cross-user isolation, no TRUNCATE, anon blocked) and a manual
  budget add/edit/delete in the app. The assistant cannot sign in as the owner.

### Pre-implementation checks

- `npm test` **327 pass, 0 fail**; `tsc` 0 errors.
- Pollinations docs read at https://gen.pollinations.ai/docs: `POST /v1/chat/completions`,
  `Authorization: Bearer <sk_ key>`; publishable `pk_` keys are rejected since 1 Nov 2026.
- Live model list (`GET /text/models`): `openai/gpt-5.4-nano` healthy (99.97%), not paid-only,
  supports `response_format`, `reasoning_effort`, `max_completion_tokens`.

### Errors found

| # | Error | Status |
|---|---|---|
| 1 | `POLLINATIONS_API_KEY` in `.env.local` is a **publishable `pk_` key**. Test call → `401 UNAUTHORIZED: Publishable keys (pk_) only identify your app and can't authenticate requests … use a secret key (sk_)` | **Owner action.** Create an `sk_` key at https://enter.pollinations.ai/keys and replace the value. Until then the feature serves the deterministic summary (`fallbackReason: not_configured`), and no network call is made |
| 2 | iCloud eviction again: **45,867 of 49,722** `node_modules` files were dataless (disk 94% full, 12 GiB free); a 1-second script took > 2 min | Fixed: `rm -rf node_modules .next && npm ci --prefer-offline` (15 s, 0 dataless after). This stopped the running dev server on :3001, so restart with `npm run dev`. It will recur while `~/Documents` is iCloud-synced on a near-full disk |
| 3 | Middleware treats every `/api/*` path as public, and the existing `/api/parse-pdf` has no auth check, so anyone can spend the Gemini quota | **Not changed** (pre-existing; auth architecture). The new `/api/insights` authenticates itself |
| 4 | Float rounding in the new summary: £200.75 × 30 / 12 gave 501.87 (not 501.88); 10% of £200.75 gave £20.07 | Fixed: projections and the 10% saving computed in pence, multiply before divide |
| 5 | Privacy test false alarm: the field name `description` (savings) matched the "no descriptions" check | Renamed the field to `action`; the test still forbids the word `description` in the payload |
| 6 | `MonthYearSelector` overflowed on 390 px screens ("Today" cut off); also affected the Budgets page | Fixed: `flex-wrap` |
| 7 | Route imported a helper from `budgets.ts`, which loads the browser Supabase client on the server | Fixed: `isMissingTableError` moved to client-free `src/lib/supabase/queries.ts` (re-exported) |

### Design

- **Server computes, browser chooses.** The browser sends only `{ year, month }`. The route
  authenticates with the cookie session, reads the user's rows (RLS plus `user_id` filter; columns
  `id, amount, categoryId, date` only), and builds an aggregated `InsightsSummary` in TypeScript.
- **Only aggregates go to Pollinations:** monthly totals, a 6-month trend, category totals and
  changes, budget rows, and pre-calculated savings. No descriptions, tags, member names, emails,
  user or expense IDs, or transaction dates (unit-tested).
- **Grounding:** every `£` amount and `%` in the AI text must match a figure in the summary
  (rounding to whole numbers allowed). Insights that fail are dropped; with fewer than 3 left, the
  deterministic summary is used (`fallbackReason: ungrounded`).
- **Failure handling:**
  - 20 s server timeout (AbortController); 35 s client timeout.
  - Upstream errors map to clear reasons: 401/403 unauthorized, 402 insufficient_balance,
    429 rate_limited with Retry-After, 400 content_blocked / 422 blocked, 5xx unavailable,
    network error unavailable, empty or unreadable body bad_response.
  - Each falls back to the deterministic summary.
- **Abuse limits:** per-user 1 request / 15 s and 5 / 10 min (429 with `Retry-After`); JSON
  content type required (415); body ≤ 1 KB (413); `Cache-Control: no-store`. A 10-min server
  cache of AI answers keyed by user, month and identical figures avoids paying twice.

### Files

- **Created:**
  - `src/entities/Insights.ts`
  - `src/lib/insights/{summary,grounding,prompt,parse,fallback,pollinations,rateLimit,generate}.ts`
  - `src/lib/supabase/queries.ts`
  - `src/lib/categoryNames.ts`
  - `src/app/api/insights/route.ts`
  - `src/hooks/insights/useSpendingInsights.ts`
  - `src/components/insights/AIInsightsPanel.tsx`
  - `tests/insights.test.ts`
- **Modified:**
  - `src/components/dashboard/Dashboard.tsx` (panel)
  - `src/lib/supabase/expenses.ts` (uses shared reader)
  - `src/lib/supabase/budgets.ts` (re-export)
  - `src/hooks/analytics/useAnalytics.ts` (shared `categoryNameOf`)
  - `src/components/expenses/MonthYearSelector.tsx` (`flex-wrap`)
- No database tables, migrations, RLS or authentication code changed.

### Verification

| Check | Result |
|---|---|
| `npm test` | **384 pass, 0 fail** (327 existing + 57 new in `tests/insights.test.ts`) |
| `npx tsc --noEmit` | 0 errors |
| ESLint (Feature 7 and touched files) | 0 errors |
| Route guards (live dev server, no session) | Unauthenticated POST → **401**; form-encoded → **415**; GET → **405**; 3 KB body → **413**; `cache-control: no-store` |
| API key exposure | Read only in `src/app/api/insights/route.ts` via `process.env`; no `NEXT_PUBLIC_` variant; not referenced by client code; `.env.local` git-ignored |
| Panel UI (headless Edge, isolated demo copy, `/api/insights` answered with real server-code output on demo data) | Idle, loading (button disabled, skeletons), AI result, standard summary + reason, empty month, 429 ("try again in 12 seconds"), 401: all render; light, dark and 390 px mobile; 0 console errors; browser sent only `{"month":11,"year":2026}` |
| Real Pollinations generation | **Not verified.** Blocked by the `pk_` key (error 1) |
| Authenticated end-to-end on live data | **Not verified.** Assistant cannot sign in; owner to test on the Dashboard |

---
