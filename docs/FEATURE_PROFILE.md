# Profile and account backend

The `/profile` page (Profile, Security, Preferences, Data tabs) is backed by
a database migration and a set of authenticated API routes. The browser never
writes profile data directly: every change goes through `/api/profile/*`,
which validates it, applies it with the caller's session (so RLS applies),
and records security-relevant actions in an activity log.

## Setup

Apply `supabase/migrations/20261117000000_create_profiles.sql` in the Supabase
SQL editor (it is idempotent). Until it is applied, the app still works:

| Without the migration | With the migration |
|---|---|
| Name, avatar, income and theme are kept in auth `user_metadata` | Kept in `public.profiles` (constraints + RLS) |
| Activity history shows "needs the migration" | Recent events are listed |
| Stats use several queries | One `profile_stats()` call |
| "Delete account" is disabled | Available (password + typed `DELETE`) |

Editing the profile works in both modes. Without the migration, only the
Activity and Delete account cards mention that it is missing.

## Data model

- **`profiles`** — one row per auth user: `fullName`, `avatarSeed`,
  `monthlyIncome`, `theme`. Created by a trigger on sign-up and backfilled
  from existing `user_metadata`. RLS: a user can select, insert and update
  only their own row; there is no delete policy.
- **`account_activity`** — append-only log (`event`, `detail`, `device`,
  `createdAt`). RLS allows select and insert of own rows only. `device` is a
  coarse "Chrome on macOS" label; raw user agents and IPs are not stored.
  Rows older than 365 days are pruned on insert.
- **`profile_stats()`** — `SECURITY INVOKER`, returns counts, first expense
  date and spend this year/month for `auth.uid()`.
- **`delete_my_account()`** — `SECURITY DEFINER` (it must delete from
  `auth.users`) but acts only on `auth.uid()`; it deletes the user's rows from
  every owned table, then the auth user, in one transaction.

## API

All routes live in `src/app/api/profile/`; shared helpers are in
`src/lib/profile/server.ts`, the contract (Zod schemas and types) in
`src/lib/profile/schemas.ts`, and the browser client in `src/lib/api/profile.ts`.

| Method and path | Purpose | Rate limit (per user) |
|---|---|---|
| `GET /api/profile` | Account summary and profile | — |
| `PATCH /api/profile` | Update name, avatar, income or theme | 60 / 10 min |
| `DELETE /api/profile` | Delete the account (password + `DELETE`) | 5 / hour |
| `GET /api/profile/stats` | Header figures | — |
| `GET /api/profile/activity` | Last 25 account events | — |
| `POST /api/profile/password` | Change password (current password verified) | 5 / 15 min |
| `POST /api/profile/email` | Request an email change (confirmation link) | 3 / hour |
| `DELETE /api/profile/sessions` | Sign out of every device | — |
| `GET·POST·DELETE /api/profile/sample-data` | Status, load, remove sample data | 4 / 10 min |
| `GET /api/profile/export` | All expenses as CSV | 10 / 10 min |

Errors are JSON: `{ error, field?, retryAfterSeconds? }`, where `field` names
the input to highlight.

## Security

- **Authentication in every handler.** Middleware does not check `/api/*`.
- **RLS is the enforcement;** queries also filter on the verified user id.
- **CSRF:** state-changing requests must be same-origin, and bodies must be
  JSON with a size cap.
- **Strict schemas:** unknown keys are rejected, so a client cannot set `id`
  or other columns.
- **Password checks** use a throwaway, non-persisting Supabase client, so the
  request's session cookies are untouched; the temporary session is revoked
  immediately. One side effect is that Supabase updates "last sign-in". Failed
  checks are logged.
- **Limits:** rate limits are in-memory, so they hold for one server process.
  Multi-instance hosting would need a shared store, as with `/api/insights`.
- **No caching:** responses are `Cache-Control: no-store`. The CSV export
  escapes formula injection.

## Theme sync

`ThemeSync` (mounted by the protected layout) applies the account's saved
theme on first load. It also saves later changes, from the navbar toggle, ⌘K
or Preferences, through `PATCH /api/profile`. When the account has no saved
theme yet, the device's current choice is saved to it.

## Tests

`tests/profile.test.ts` covers the request schemas, schema/migration agreement
(activity events and limits), device labels, email masking, password strength,
the CSV export and the sample data generator.
