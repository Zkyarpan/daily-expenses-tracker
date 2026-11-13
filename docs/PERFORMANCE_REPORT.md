# Performance report

Living record of measured performance for the UI/UX redesign. Each stage adds
its own section. Every figure here comes from a recorded measurement. Nothing is
estimated.

## Environment (13 November 2026)

| Item | Value |
|---|---|
| Machine | macOS (Darwin 27), Apple Silicon |
| Node.js | v24.15.0 (`.nvmrc` pins 20.19.5; Next.js 15.5.9 supports both) |
| npm | 12.2.1, `package-lock.json` (pnpm lockfile removed; no `pnpm-workspace.yaml`) |
| Next.js / React | 15.5.9 (Turbopack dev) / 19.1.0 |
| Project location | `~/Documents/CN7021/daily-expenses-tracker`, synced by iCloud Drive "Desktop & Documents" |
| Free disk space | 11 GiB at start, 7.9 GiB at the end of Stage 2 (95–96 % used) |

## Method

- **Dev timing:** a script starts `next dev --turbopack -p 3001`, records the
  "Ready" time, then requests each route twice. The first request is *cold*
  (includes compilation) and the second is *warm*. Stdin is kept open so Next
  does not exit.
- **Demo mode** (Supabase URL and key set to empty strings in the process
  environment, which take precedence over `.env.local`) is used so protected
  pages render without a login. No files are changed to do this.
- **Bundle sizes:** `next build` "First Load JS" per route, with the real
  public Supabase settings.
- **Browser checks:** headless Microsoft Edge driven over the Chrome DevTools
  Protocol at 375, 768, 1024 and 1440 px, in light and dark mode. Each check
  records console errors, uncaught exceptions and horizontal overflow
  (`scrollWidth > innerWidth`).
- **Local comparison:** a temporary `git clone` of the same commit in a
  non-iCloud folder (session scratch space, deleted afterwards).

## Stage 1: baseline and root cause

### Finding: the iCloud folder is the dominant cause of slowness

At the start, **20,572 of 49,690** files in `node_modules` were iCloud
"dataless" placeholders (evicted to free disk space). Reading one blocks until
macOS downloads it.

**Same code, same Node, same Turbopack: iCloud folder vs local folder**

| Measurement | iCloud `~/Documents` | Local folder |
|---|---|---|
| `next dev` Ready (reported) | 974 ms | 1,260 ms (first start, cold OS cache) |
| `/yearly-charts` cold compile | **95.1 s** | **1.4 s** |
| `/analytics` cold compile | 5.7 s | 0.25 s |
| `/login` cold compile | 1.3 s | 2.0 s |
| `/` (dashboard) cold compile | 0.97 s | 0.86 s |
| All 8 routes, cold + warm | 107.5 s | 12.8 s |
| `npm ci` | **did not finish in > 10 min** | **7.5 s** |
| `git status` | hung > 2 min | 0.04 s (see below) |

Route compile times only blow up when the route pulls in evicted packages.
`/yearly-charts` loads ExcelJS and chart code whose files had been evicted.

**Eviction is continuous, not occasional.** After `node_modules` was
reinstalled (0 evicted files):

- Within minutes **7,101** freshly installed `node_modules` files and
  **733–830** project files (`src/`, `tests/`, `docs/`, `.git/`) were evicted
  again. `package.json`, `next.config.ts` and `.env.local` were among them.
- `npm ci` itself hung, blocked in a `read()` of the evicted `package.json`.
- iCloud created conflict copies inside `.git` (`index 2`, `index 3`,
  `gk/config 3/4`) and inside `.next` (`… 2.json` build manifests). This
  matches the earlier "missing Next.js build manifests" errors.

**Conclusion.** The three historical symptoms (40–95 s first loads, ETIMEDOUT
filesystem errors and missing build manifests) share one cause: the project is
in an iCloud-synced folder on a nearly full disk. Next.js, Turbopack and Node
are not at fault.

**Mitigations used during this work (no project changes):**
- Re-download evicted files with `brctl download` before reading them.
- Run git with `-c core.trustctime=false -c core.checkStat=minimal`, because
  eviction changes inode metadata and makes git re-read (and re-download)
  unchanged files.
- Run builds, type checks, linting and benchmarks in a local clone.

**Durable fix (owner's decision, not applied):** move the project out of
`~/Documents`, for example `git clone` it to `~/Developer/…`, or free enough
disk space that macOS stops evicting. Do not reuse `~/Projects/expenses-tracker`:
it is an older copy.

### Quality baseline (local clone, commit `cf33ddf`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors (3.4 s) |
| ESLint (`src tests scripts`) | **23 errors, 58 warnings**: 15 import order (auto-fixable), 7 `react-hooks/set-state-in-effect`, 1 `no-explicit-any` |
| `npm test` | **384 pass, 0 fail** (61 suites, 0.58 s) |
| `npm run build` | **Fails**: lint errors above, then `/login` prerender (`useSearchParams()` without `<Suspense>`) |
| Browser, 18 views (9 routes, 375–1440 px, light/dark) | 0 console errors, 0 exceptions, no horizontal overflow |

npm 12 skipped install scripts for `esbuild`, `fsevents` and `sharp`
(`npm install-scripts ls`). All three ship prebuilt binaries, and the tests
(which use esbuild through `tsx`) and builds pass.

### Bundle-size baseline (First Load JS)

Measured with a temporary `<Suspense>` wrapper on `/login`, in the scratch
clone only, to get past the prerender failure.

| Route | First Load JS | | Route | First Load JS |
|---|---|---|---|---|
| `/` dashboard | **362 kB** | | `/login` | 192 kB |
| `/yearly-charts` | 310 kB | | `/signup` | 193 kB |
| `/trackers` | 299 kB | | `/forgot-password` | 192 kB |
| `/import-expenses` | 280 kB | | `/update-password` | 189 kB |
| `/expenses` | 278 kB | | Shared by all | 102 kB |
| `/analytics` | 265 kB | | Middleware | 95.4 kB |
| `/budgets` | 261 kB | | | |

The dashboard is the heaviest route. Its page chunk alone is 125 kB. It
eagerly imports the demo dataset and Recharts. This is a Stage 4/7 target.

### Other findings for later stages

- Per page load, Supabase Auth `getUser()` is called by the middleware, the
  protected layout and (before Stage 2) the alerts shell in the browser.
  Budgets calls it again via `useCurrentUser`, and each expense/budget/tracker
  write calls it to get `user_id`.
- `formatCurrency` built a new `Intl.NumberFormat` on every call (once per
  table row per render). Fixed in Stage 2.
- Possibly unused dependencies, to verify in Stage 7: `@hookform/resolvers`,
  `@tanstack/react-query-devtools`, `pdf-parse`.

## Stage 2: design foundation

Stage 2 is visual infrastructure, so the goal was **no regression**.

| Check | Before | After |
|---|---|---|
| First Load JS, every existing route | see table above | **identical, byte for byte** |
| `/design-system` (new, dev-only) | — | 116 kB (production renders the not-found page) |
| Dev Ready (reported) | 662 ms | 677 ms |

Dev timings were taken back to back on the same warm local clone (second of two
runs each, single sample per route):

| Route | Cold before | Cold after | Warm before | Warm after |
|---|---|---|---|---|
| `/login` | 1,367 ms | 1,381 ms | 40 ms | 43 ms |
| `/` | 776 ms | 828 ms | 55 ms | 85 ms |
| `/expenses` | 346 ms | 371 ms | 57 ms | 67 ms |
| `/budgets` | 265 ms | 321 ms | 73 ms | 108 ms |
| `/analytics` | 312 ms | 336 ms | 82 ms | 84 ms |
| `/yearly-charts` | 1,234 ms | 1,443 ms | 168 ms | 160 ms |
| `/trackers` | 302 ms | 349 ms | 56 ms | 63 ms |
| `/import-expenses` | 292 ms | 284 ms | 60 ms | 67 ms |

These are single samples on a development server, so differences of tens of
milliseconds are within run-to-run variance. Stage 7 will benchmark the
production server with repeated samples. Stage 2 changes that are expected to
help in real use (not separately measured yet):

- Removed one browser round-trip to Supabase Auth per page load (the alerts
  shell now receives the verified user id from the server layout).
- Added a route-level `loading.tsx`, which shows a skeleton immediately on
  navigation and lets Next.js prefetch dynamic routes up to that boundary in
  production.
- Cached currency formatters.
