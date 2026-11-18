# Lend & borrow, Wishlist and Savings this month

Three features that answer "who owes who, what do I want to buy, and am I
saving?". Home shows them together in **Your money at a glance**. The header
**+ New** menu adds an expense, an IOU or a wishlist item from any page.

## Setup

The data lives in two new tables. Run both migrations once, in this order:

1. `supabase/migrations/20261117000000_create_profiles.sql`
2. `supabase/migrations/20261118000000_create_ious_and_wishlist.sql`

Until they are applied, the pages show a **Finish setup** card. It has "Copy
setup SQL" (both files, in order, from `GET /api/setup/sql`), "Open SQL
editor" (this project's Supabase SQL editor) and "Check again". The app can't
create tables itself: that needs database admin rights, which the browser key
doesn't have. Savings this month works without the tables, using the
profile's monthly income.

## Features

| Feature | Page | What it does |
|---|---|---|
| Lend & borrow | `/lend-borrow` | Money lent (they owe you) or borrowed (you owe them). Shows totals, net balance and per-person balances, and flags overdue entries. You can record part payments, mark an entry settled (with Undo) or reopen it. |
| Wishlist | `/wishlist` | Items with a price, priority, target date, link and notes. You can put money aside or take it out. "Bought it" can also add the purchase to your expenses; restoring the item removes that expense. Items are flagged "Affordable this month" against safe-to-spend. |
| Savings this month | Home | Income − spending so far, the projected month end at the current spending rate, and status against the monthly savings goal. Also shows **safe to spend** (income − goal − spent) and the same figure per remaining day. |

Income and the savings goal are set in **Profile → Edit profile**.

## Data model

- **`ious`:** `direction` (`lent`/`borrowed`), `person`, `amount`,
  `paidAmount`, `date`, `dueDate`, `description`, `settledAt`. A trigger sets
  `settledAt` exactly when `paidAmount` reaches `amount`, so the client can't
  make the two disagree.
- **`wishlist_items`:** `name`, `price`, `savedAmount`, `priority`,
  `categoryId` (the category used for the expense when bought), `url`
  (http/https only), `notes`, `targetDate`, `purchasedAt`, `expenseId`.
- **`profiles."monthlySavingsGoal"`:** an optional new column.

Both tables have RLS for select, insert, update and delete of the user's own
rows only, and cascade when the user is deleted.

## API

The routes use the same model as the profile backend: authenticated,
same-origin JSON only, strict Zod schemas, per-user rate limits and
`no-store` responses. Shared plumbing is in `src/lib/server/http.ts`.

| Route | Methods |
|---|---|
| `/api/ious` | `GET` (list + summary), `POST` (create) |
| `/api/ious/:id` | `PATCH` (`edit`, `payment`, `settle`, `reopen`), `DELETE` |
| `/api/wishlist` | `GET` (list + summary), `POST` (create) |
| `/api/wishlist/:id` | `PATCH` (`edit`, `save`, `buy`, `restore`), `DELETE` |
| `/api/money/overview` | `GET` (savings + IOU and wishlist summaries) |
| `/api/setup/sql` | `GET` (the two migrations, read-only) |

`GET` routes return `{ setupRequired: true }` while the tables are missing.
Writes return `409` with the same flag. Overview and IOU routes take
`?today=YYYY-MM-DD` from the browser, so "this month" and "overdue" follow
the user's own date; dates more than about a day from the server's are
ignored.

## Code

- Contract: `src/lib/money/schemas.ts`.
- Calculations (pure, in integer pence): `src/lib/money/summary.ts`.
- Server data access: `src/lib/money/server.ts`.
- Browser client: `src/lib/api/money.ts`.
- Hooks: `src/hooks/money/`.
- UI: `src/components/money/`. `QuickAddProvider` owns the add dialogs.
- Tests: `tests/money.test.ts`.

Sample data (Profile → Data) also adds 7 IOUs and 5 wishlist items.
