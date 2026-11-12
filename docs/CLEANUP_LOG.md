# Cleanup audit

Audit date: 2026-11-05

## Checkpoint

The host Git executable could not run because macOS command-line developer tools
are unavailable (`xcode-select` failure). Before editing, a source checkpoint was
created at `../checkpoints/daily-expenses-tracker-20261105-source-checkpoint.tar.gz`.
It excludes `.git`, `.env*`, `node_modules`, `.next`, and other generated script
output. The repository's Git metadata and history remain untouched.

## Unused-file audit

No source files were deleted during the initial shared-layout pass. The following
candidates were checked:

| Candidate | Evidence checked | Decision |
| --- | --- | --- |
| `src/app/(protected)/test-supabase/page.tsx` | No imports or navigation links; route performs a read-only Supabase smoke test and can help diagnose a configured deployment. | Keep. It is a working diagnostic route, and the brief says not to remove working functionality solely because it is not in navigation. |
| `src/app/(protected)/credits/page.tsx` | No imports or navigation links; route contains the Flaticon attribution required by the current icon asset. | Keep. Removing it could discard licence attribution. |
| `src/components/ui/avatar.tsx` | No current product import, but it is a standard shadcn/ui primitive suitable for account UI. | Keep. It is reusable UI infrastructure, not proven dead code. |
| `src/components/ui/calendar.tsx` | No current product import, but it is a standard date-picker primitive and the expense domain uses dates. | Keep. It is reusable UI infrastructure, not proven dead code. |
| `src/components/ui/hover-card.tsx` | No current product import; no duplicate implementation found. | Keep until a broader component inventory confirms it is not part of a planned interaction. |
| `src/components/ui/resizable.tsx` | No current product import; the charts page still uses the related chart layout without this wrapper. | Keep. It is a reusable shadcn/ui primitive and deleting it would be premature. |
| `src/components/ui/scroll-area.tsx` | No current product import; it is a standard shadcn/ui primitive available for future long-form panels. | Keep until the component inventory is intentionally pruned. |
| `src/components/ui/form.tsx` | No feature currently imports the wrapper, but it depends on `react-hook-form` and is a standard typed form primitive. | Keep until Settings/forms work is implemented or the library is intentionally pruned. |

## Dependency audit

- `@tanstack/react-query-devtools` is listed in `package.json` but has no source
  import. It is a safe package-removal candidate for a later dependency-only
  cleanup, after confirming no local tooling expects it.
- `@hookform/resolvers` is listed but has no source import. Keep for now because
  the existing `form` primitive uses `react-hook-form` and tracker forms may be
  migrated to it in a later accessibility pass; remove both together only when
  that direction is explicitly abandoned.
- All other dependencies were matched to active imports, scripts, or shadcn/ui
  primitives during this audit.

## Deleted files

The auth-only files listed in the requested public-entry audit below were removed
after the user explicitly requested that login pages and redirects be removed.

## Requested public-entry cleanup — 2026-11-05

The user explicitly requested that the main application open at `/` without
login pages or login redirects. The following auth-only files are therefore
proven unused after removing the auth gate from the shared app layout and
middleware:

| File | Evidence | Action |
| --- | --- | --- |
| `src/app/login/page.tsx` | Only rendered the login-mode `AuthForm`; no remaining navigation should point to it. | Delete. |
| `src/app/signup/page.tsx` | Only rendered the signup-mode `AuthForm`; no remaining navigation should point to it. | Delete. |
| `src/components/auth/AuthForm.tsx` | Imported only by the two deleted auth pages. | Delete. |
| `src/app/auth/callback/route.ts` | Only served email-confirmation auth flow, which is removed with the login/signup surface. | Delete. |
| `src/utils/supabase/server.ts` | Imported only by the auth-protected layout and auth callback route. | Delete after those imports are removed. |
| `src/middleware.ts` | Only refreshed Supabase sessions and redirected unauthenticated requests to login. | Delete so `/` and app routes are public. |

Supabase browser configuration, data hooks, client mutations, and database
files are not removed or changed. Anonymous database access must still be
allowed by the configured Supabase policies for live data to appear; no RLS or
cloud data was changed.

